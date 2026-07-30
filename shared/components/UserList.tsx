"use client";

import EditIcon from "@mui/icons-material/Edit";
import PersonAdd from "@mui/icons-material/PersonAdd";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { CircularProgress, Link as MuiLink } from "@mui/material";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import api, { apiFetch } from "@/app/api";
import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { getFirstAccessiblePage } from "@/shared/utils/navigation";
import { isSyntheticAuditUser } from "@/shared/utils/userVisibility";

interface UserFormData {
    id?: string;
    first_name: string;
    last_name: string;
    email: string;
    mobile: string;
    role: string;
    status: "Active" | "Inactive";
    language: "English" | "Hebrew";
    time_zone: string;
    locale: string;
}

interface User extends UserFormData {
    id: string;
    lastLogin?: string;
    name?: string;
    is_audit_user?: boolean;
    business_unit_id?: number | null;
    BusinessUnit?: {
        id: number;
        name: string;
    } | null;
}

interface UserListProps {
    accountId?: number | string;
    variant?: "standalone" | "embedded";
    rowsPerPage?: number;
    showDescription?: boolean;
    height?: string | number;
    onUserUpdate?: () => void;
}

// Add User Button Component
const AddUserButton = React.memo(
    ({
        onAddClick,
        variant = "standalone",
    }: {
        onAddClick: () => void;
        variant?: "standalone" | "embedded";
    }) => {
        const { t, i18n } = useTranslation(["users"]);

        return (
            <Tooltip
                title={t("actions.add_user")}
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
                    onClick={onAddClick}
                    className="toolbar-button"
                >
                    <PersonAdd />
                </IconButton>
            </Tooltip>
        );
    }
);

AddUserButton.displayName = "AddUserButton";

export default function UserList({
    accountId,
    variant = "standalone",
    showDescription = true,
    height = "100%",
    onUserUpdate,
}: UserListProps) {
    const { t, i18n } = useTranslation(["users", "common", "security_roles"]);
    const { data: session, status, update: updateSession } = useSession();
    const router = useRouter();
    const { showToast } = useToast();
    const theme = useTheme();

    const effectiveAccountId =
        accountId ||
        (session?.user?.view_as_user_id &&
            session?.user?.view_as_user_account_id
            ? session.user.view_as_user_account_id
            : session?.user?.account_id);

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            effectiveAccountId,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasManageUsersPermission = userPermissions.includes("manage_users");

    const fetchUserDetails = async (userId: string) => {
        try {
            const response = await apiFetch(`/api/entities/users?account_id=${effectiveAccountId}&userId=${userId}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Failed to fetch user details");
            }

            const userData = await response.json();
            return userData;
        } catch (error) {
            showToast(t("messages.toast_error_fetching_user_details"), "error");
            throw error;
        }
    };

    const handleEditUser = async (userId: string) => {
        router.push(`/app/settings/users/${userId}`);
    };

    const handleViewAsUser = async (userId: string) => {
        try {
            if (!session?.user) {
                throw new Error("No session user available");
            }

            // Check use_view_as permission
            const canUseViewAs = userPermissions.includes("use_view_as");

            if (!canUseViewAs) {
                throw new Error(
                    "View As functionality requires use_view_as permission"
                );
            }

            const requestBody = { userId };

            const response = await apiFetch("/api/entities/users/view-as", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to set view as user"
                );
            }

            const successData = await response.json();
            const { permissions, viewAsUserAccountId } = successData;

            const updatedSession = await updateSession({
                view_as_user_id: userId,
            });

            // Determine the first accessible page based on the target user's permissions
            const redirectPath = getFirstAccessiblePage(permissions || [], viewAsUserAccountId);

            // Redirect to the calculated page after setting view-as user
            // Use window.location to ensure a full page reload with the new session
            const currentLocale = i18n.language || "en";
            window.location.href = `/${currentLocale}${redirectPath}`;
        } catch (error) {
            showToast(t("messages.toast_error_view_as"), "error");
        }
    };

    // Search and filter state
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [filterStatus, setFilterStatus] = useState<
        "Active" | "Inactive" | ""
    >("");
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "name", sort: "asc" },
    ]);

    // Create query key
    const queryKey = useMemo(
        () => [
            "users-virtual",
            {
                query: debouncedSearch,
                status: filterStatus,
                sortField: sortModel[0]?.field,
                sortDirection: sortModel[0]?.sort,
                accountId: effectiveAccountId,
            },
        ],
        [
            debouncedSearch,
            filterStatus,
            sortModel[0]?.field,
            sortModel[0]?.sort,
            effectiveAccountId,
        ]
    );

    // Use virtual infinite scroll hook
    const {
        data: users,
        totalRecords,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey,
        queryFn: async (page: number) => {
            const params: Record<string, string> = {
                page: page.toString(),
                limit: "10",
                search: debouncedSearch,
                sortField: sortModel[0]?.field || "name",
                sortDirection: sortModel[0]?.sort || "asc",
                account_id: effectiveAccountId?.toString() || "",
            };

            // Add status filter if selected
            if (filterStatus) {
                params.status = filterStatus;
            }

            const url = `/api/entities/users?${new URLSearchParams(params)}`;

            const response = await apiFetch(url);

            if (!response.ok) {
                // Handle 403 (Forbidden) gracefully - user doesn't have permission
                if (response.status === 403) {
                    return {
                        data: [],
                        totalRecords: 0,
                        hasMore: false,
                    };
                }
                throw new Error("Failed to fetch users");
            }

            const result = await response.json();
            const fetchedUsers: User[] = result.users || [];
            const visibleUsers = fetchedUsers.filter(
                (user) => !isSyntheticAuditUser(user)
            );
            const hiddenCount = fetchedUsers.length - visibleUsers.length;

            // Transform the API response to match the expected format
            return {
                data: visibleUsers,
                totalRecords: Math.max(0, (result.total || 0) - hiddenCount),
                // Use the unfiltered page length: a page containing only hidden
                // actors must not prematurely stop infinite scrolling.
                hasMore: fetchedUsers.length === 10,
            };
        },
    });

    // Note: reset() is not needed here because the queryKey changes when search/sort changes,
    // which automatically triggers a new query through useVirtualInfiniteScroll

    // Check use_view_as permission
    const canUseViewAs = userPermissions.includes("use_view_as");

    // Status filter component
    const StatusFilterComponent = useMemo(() => {
        interface FilterOption {
            label: string;
            value: string;
        }

        const filterOptions: FilterOption[] = [
            {
                label: t("values.show_all_users"),
                value: "",
            },
            {
                label: t("values.show_active_users"),
                value: "Active",
            },
            {
                label: t("values.show_inactive_users"),
                value: "Inactive",
            },
        ];

        const currentValue =
            filterOptions.find((option) => option.value === filterStatus) ||
            filterOptions[0];

        return (
            <ToolbarDropdownFilter<FilterOption>
                value={currentValue}
                onChange={(newValue: FilterOption | null) => {
                    setFilterStatus(
                        newValue?.value as "Active" | "Inactive" | ""
                    );
                }}
                options={filterOptions}
                getOptionLabel={(option: FilterOption) => option.label}
                isOptionEqualToValue={(
                    option: FilterOption,
                    value: FilterOption
                ) => option.value === value.value}
                placeholder={t("fields.status_filter")}
            />
        );
    }, [filterStatus, t]);

    // Helper function to get translated role name
    const getTranslatedRoleName = (role: string) => {
        if (!role) return "";
        // Use security_roles namespace with the role name directly (e.g., "Account_Manager", "Collection_Manager")
        const translationKey = `values.${role}`;
        const translated = t(translationKey, {
            ns: "security_roles",
            defaultValue: role,
        });
        // Return the translated value (all roles have translations in security_roles.json)
        return translated;
    };

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "name",
                headerName: t("fields.name"),
                flex: 1,
                minWidth: variant === "embedded" ? 120 : 150,
                renderCell: (params) => {
                    const userName =
                        params.row.name ||
                        `${params.row.first_name || ""} ${params.row.last_name || ""}`.trim() ||
                        t("values.status_unnamed_user");
                    const userUrl = effectiveAccountId
                        ? `/app/settings/users/${params.row.id}?accountId=${effectiveAccountId}`
                        : `/app/settings/users/${params.row.id}`;
                    return (
                        <MuiLink
                            component={Link}
                            href={userUrl}
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
                                variant={variant === "embedded" ? "caption" : "body2"}
                                sx={{
                                    color: "inherit",
                                }}
                            >
                                {userName}
                            </Typography>
                        </MuiLink>
                    );
                },
                sortComparator: (v1, v2) => {
                    return (v1 || "").localeCompare(v2 || "");
                },
            },
            {
                field: "email",
                headerName: t("fields.email"),
                flex: 1,
                minWidth: variant === "embedded" ? 150 : 200,
                renderCell: (params) => (
                    <Typography
                        variant={variant === "embedded" ? "caption" : "body2"}
                    >
                        {params.row.email}
                    </Typography>
                ),
                sortComparator: (v1, v2) => {
                    return (v1 || "").localeCompare(v2 || "");
                },
            },
            {
                field: "role",
                headerName: t("fields.role"),
                flex: 1,
                minWidth: variant === "embedded" ? 100 : 120,
                valueGetter: (params: { row: User }) => {
                    if (!params?.row?.role) return "";
                    return getTranslatedRoleName(params.row.role);
                },
                renderCell: (params) => {
                    if (!params.row.role) return "";
                    const roleUrl = effectiveAccountId
                        ? `/app/settings/roles/${params.row.role}?accountId=${effectiveAccountId}`
                        : `/app/settings/roles/${params.row.role}`;
                    return (
                        <MuiLink
                            component={Link}
                            href={roleUrl}
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
                                variant={
                                    variant === "embedded" ? "caption" : "body2"
                                }
                                sx={{
                                    color: "inherit",
                                }}
                            >
                                {getTranslatedRoleName(params.row.role)}
                            </Typography>
                        </MuiLink>
                    );
                },
                sortComparator: (v1, v2) => {
                    return (v1 || "").localeCompare(v2 || "");
                },
            },
            {
                field: "business_unit",
                headerName: t("fields.business_unit", { ns: "users" }),
                flex: 1,
                minWidth: variant === "embedded" ? 120 : 150,
                valueGetter: (params: { row: User }) => {
                    return params.row.BusinessUnit?.name || "";
                },
                renderCell: (params) => {
                    const buName = params.row.BusinessUnit?.name;

                    // Only show link if we have business unit name and account ID
                    if (buName && effectiveAccountId) {
                        const accountUrl = `/app/admin/accounts/${effectiveAccountId}/details`;
                        return (
                            <MuiLink
                                component={Link}
                                href={accountUrl}
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
                                    variant={
                                        variant === "embedded" ? "caption" : "body2"
                                    }
                                    sx={{
                                        color: "inherit",
                                    }}
                                >
                                    {buName}
                                </Typography>
                            </MuiLink>
                        );
                    }

                    return (
                        <Typography
                            variant={
                                variant === "embedded" ? "caption" : "body2"
                            }
                        >
                            {buName || "-"}
                        </Typography>
                    );
                },
                sortComparator: (v1, v2) => {
                    return (v1 || "").localeCompare(v2 || "");
                },
            },
            {
                field: "status",
                headerName: t("fields.status", { ns: "common" }),
                flex: variant === "embedded" ? 0.5 : 1,
                minWidth: variant === "embedded" ? 80 : 100,
                renderCell: (params) => {
                    const isActive = params.row.status === "Active";
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
                field: "freeze",
                headerName: t("fields.freeze"),
                flex: variant === "embedded" ? 0.5 : 1,
                minWidth: variant === "embedded" ? 80 : 100,
                renderCell: (params) => {
                    const isFrozen = params.row.freeze === true;
                    return (
                        <Chip
                            label={
                                isFrozen
                                    ? t("fields.yes", { ns: "common" })
                                    : t("fields.no", { ns: "common" })
                            }
                            size="small"
                            data-status={isFrozen ? "active" : "inactive"}
                        />
                    );
                },
            },
            {
                field: "actions",
                headerName: t("actions.actions"),
                sortable: false,
                filterable: false,
                width:
                    variant === "embedded"
                        ? canUseViewAs
                            ? 60
                            : 0
                        : canUseViewAs
                            ? 80
                            : 0,
                renderCell: (params) => (
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        {canUseViewAs &&
                            params.row.id !== session?.user?.id && (
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent row click from triggering
                                        handleViewAsUser(params.row.id);
                                    }}
                                    color="primary"
                                    title={t("actions.view_as_user")}
                                >
                                    <VisibilityIcon />
                                </IconButton>
                            )}
                    </Box>
                ),
            },
        ],
        [
            t,
            variant,
            canUseViewAs,
            session?.user?.id,
            effectiveAccountId,
            getTranslatedRoleName,
        ]
    );

    const customButtons = useMemo(
        () => (
            <Box
                sx={{
                    display: "flex",
                    gap: theme.spacing(2),
                    alignItems: "center",
                }}
            >
                {StatusFilterComponent}
                {/* Show Create User button if user has manage_users permission */}
                {hasManageUsersPermission && (
                    <AddUserButton
                        onAddClick={() => {
                            if (effectiveAccountId) {
                                router.push(
                                    `/app/settings/users/new?accountId=${effectiveAccountId}`
                                );
                            } else {
                                router.push("/app/settings/users/new");
                            }
                        }}
                        variant={variant}
                    />
                )}
            </Box>
        ),
        [
            variant,
            router,
            effectiveAccountId,
            StatusFilterComponent,
            theme,
            hasManageUsersPermission,
        ]
    );

    const noRowsOverlayComponent = useMemo(() => {
        const NoRowsOverlay = () => (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: variant === "embedded" ? 150 : 200,
                    textAlign: "center",
                    color: "text.secondary",
                    py: variant === "embedded" ? 4 : 8,
                }}
            >
                <Box
                    component="svg"
                    sx={{
                        width: variant === "embedded" ? 32 : 48,
                        height: variant === "embedded" ? 32 : 48,
                        mb: variant === "embedded" ? 0.5 : 1,
                        color: "text.secondary",
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </Box>
                <Typography variant={variant === "embedded" ? "body2" : "h6"}>
                    {t("actions.no_users_found")}
                </Typography>
            </Box>
        );
    }, [t, variant]);

    if (status === "loading" || isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: variant === "embedded" ? 150 : 200,
                }}
            >
                <CircularProgress color="primary" size={40} />
            </Box>
        );
    }

    if (status === "unauthenticated") {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: variant === "embedded" ? 150 : 200,
                }}
            >
                <Typography color="error">
                    {t("messages.toast_error_fetching_users")}
                </Typography>
            </Box>
        );
    }

    const content = (
        <>
            {showDescription && (
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        mb: { xs: 2, sm: 3 },
                        px: { xs: 1.5, sm: 3 },
                    }}
                >
                    {t("messages.description")}
                </Typography>
            )}

            {/* Match BusinessUnits: wrapper for consistent layout and grid alignment */}
            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    overflow: "hidden",
                }}
            >
                <EndlessScrollDataGrid
                    rows={users || []}
                    columns={columns}
                    totalRecords={totalRecords}
                    isLoading={isLoading}
                    onLoadMore={loadMore}
                    hasMore={hasMore}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    customButtons={customButtons}
                    searchValue={search}
                    onSearchChange={(value) => {
                        setSearch(value);
                    }}
                    searchPlaceholder={t("values.filters_search_users")}
                    searchDebounceMs={500}
                    searchDisabled={false}
                    resizableColumns={true}
                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                    language={i18n.language}
                    fillViewport={true}
                    noRowsMessage={t("values.empty")}
                    noRowsDescription={t("values.empty_description")}
                />
            </Box>
        </>
    );

    return (
        <Box sx={{ height, display: "flex", flexDirection: "column" }}>
            {content}
        </Box>
    );
}
