"use client";

import {
    Add as AddIcon,
    Business as BusinessIcon,
    Check as CheckIcon,
    Delete as DeleteIcon,
} from "@mui/icons-material";
import {
    Box,
    Chip,
    CircularProgress,
    IconButton,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import api, { apiFetch } from "@/app/api";
import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

import { DeleteBusinessUnitDialog } from "./DeleteBusinessUnitDialog";
import { UpsertBusinessUnitModal } from "./UpsertBusinessUnitModal";

interface BusinessUnit {
    id: number;
    name: string;
    parent_id?: number | null;
    external_id?: string | null;
    status: "Active" | "Inactive";
    is_primary?: boolean;
    Parent?: BusinessUnit | null;
    created_by?: string | null;
    created_at?: string | Date;
    modified_by?: string | null;
    modified_at?: string | Date;
    User_BusinessUnit_created_byToUser?: {
        id: string;
        name: string;
        email: string;
    } | null;
    User_BusinessUnit_modified_byToUser?: {
        id: string;
        name: string;
        email: string;
    } | null;
}

interface BusinessUnitsProps {
    accountId: number;
}

const _rowsPerPage = 10;

const AddBusinessUnitIcon = () => {
    const theme = useTheme();
    return (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
            <BusinessIcon />
            <AddIcon
                sx={{
                    position: "absolute",
                    right: -4,
                    bottom: -4,
                    fontSize: "0.8rem",
                    backgroundColor: "primary.main",
                    color: "primary.contrastText",
                    borderRadius: "50%",
                    padding: theme.spacing(0.25),
                }}
            />
        </Box>
    );
};

const AddBusinessUnitButton = React.memo(
    ({ onAddClick }: { onAddClick: () => void }) => {
        const { t, i18n } = useTranslation(["business_unit", "common"]);

        return (
            <Tooltip
                title={t("actions.add", { ns: "common" })}
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
                    <AddBusinessUnitIcon />
                </IconButton>
            </Tooltip>
        );
    }
);

AddBusinessUnitButton.displayName = "AddBusinessUnitButton";

export function BusinessUnits({ accountId }: BusinessUnitsProps) {
    const { t, i18n } = useTranslation(["business_unit", "common"]);
    const theme = useTheme();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { data: session } = useSession();

    // Fetch user permissions to check manage_business_units permission
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
        staleTime: 0, // Don't cache - always fetch fresh permissions
        gcTime: 0,
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasManageBusinessUnitsPermission = userPermissions.includes(
        "manage_business_units"
    );

    const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedBusinessUnit, setSelectedBusinessUnit] =
        useState<BusinessUnit | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "hierarchical", sort: "asc" },
    ]);

    // Fetch all business units once to build hierarchy map (for depth calculation)
    const { data: allBusinessUnitsData } = useQuery({
        queryKey: ["business-units-all", accountId],
        queryFn: async () => {
            if (!accountId) return [];
            const response = await apiFetch(`/api/entities/accounts/${accountId}/business-units?page=1&limit=1000`
            );
            if (!response.ok) return [];
            const result = await response.json();
            return Array.isArray(result) ? result : result?.data || [];
        },
        enabled: !!accountId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const allBusinessUnits = Array.isArray(allBusinessUnitsData)
        ? allBusinessUnitsData
        : [];

    // Helper function to calculate hierarchy depth
    const calculateDepth = useCallback(
        (
            businessUnit: BusinessUnit,
            allBusinessUnits: BusinessUnit[]
        ): number => {
            if (!businessUnit.parent_id) {
                return 0; // Top level (no parent)
            }

            // Build a map for quick lookup
            const buMap = new Map<number, BusinessUnit>();
            allBusinessUnits.forEach((bu) => buMap.set(bu.id, bu));

            // Traverse up the parent chain to calculate depth
            let depth = 0;
            let currentParentId: number | null = businessUnit.parent_id;

            while (currentParentId !== null && depth < 10) {
                // Safety limit to prevent infinite loops
                depth++;
                const parent = buMap.get(currentParentId);
                if (!parent || !parent.parent_id) {
                    break;
                }
                currentParentId = parent.parent_id;
            }

            return depth;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort;
    const queryKey = useMemo(
        () => [
            "business-units-virtual",
            {
                query: debouncedSearch,
                sortField,
                sortDirection,
                accountId: accountId,
                refreshKey,
            },
        ],
        [debouncedSearch, sortField, sortDirection, accountId, refreshKey]
    );

    const {
        data: businessUnits,
        totalRecords,
        isLoading,
        isLoadingMore: _isLoadingMore,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey,
        queryFn: async (page: number) => {
            if (!accountId) {
                return {
                    data: [],
                    totalRecords: 0,
                    hasMore: false,
                };
            }

            const sortField = sortModel[0]?.field || "name";
            const sortDirection = sortModel[0]?.sort || "asc";

            // Hierarchical and level sorts are handled by the backend
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "10",
                sortField:
                    sortField === "level" ? "hierarchical" : sortField,
                sortDirection: sortDirection,
            });

            // Add search query if provided
            if (debouncedSearch) {
                params.append("query", debouncedSearch);
            }

            const url = `/api/entities/accounts/${accountId}/business-units?${params.toString()}`;

            const response = await apiFetch(url);

            if (!response.ok) {
                const errorData = await response
                    .json()
                    .catch(() => ({ error: "Failed to fetch business units" }));
                throw new Error(
                    errorData.error || "Failed to fetch business units"
                );
            }

            const result = await response.json();

            // Handle different response structures
            let data = [];
            let totalRecords = 0;

            // Check if response has direct data array (some APIs return array directly)
            if (Array.isArray(result)) {
                data = result;
                totalRecords = result.length;
            }
            // Check if response has nested data property
            else if (result.data && Array.isArray(result.data)) {
                data = result.data;
                totalRecords =
                    result.total !== undefined
                        ? result.total
                        : result.data.length;
            }
            // Check if response has other common patterns
            else if (
                result.businessUnits &&
                Array.isArray(result.businessUnits)
            ) {
                data = result.businessUnits;
                totalRecords =
                    result.total !== undefined
                        ? result.total
                        : result.businessUnits.length;
            }
            // Fallback: try to find any array property
            else {
                const arrayKey = Object.keys(result).find((key) =>
                    Array.isArray(result[key])
                );
                if (arrayKey) {
                    data = result[arrayKey];
                    totalRecords =
                        result.total !== undefined
                            ? result.total
                            : result[arrayKey].length;
                }
            }

            // Add level to data for display
            const dataWithLevel = data.map((bu: BusinessUnit) => ({
                ...bu,
                level: calculateDepth(bu, allBusinessUnits),
            }));

            return {
                data: dataWithLevel,
                totalRecords: totalRecords,
                hasMore: data.length === 10,
            };
        },
    });

    const statusMutation = useMutation({
        mutationFn: async ({
            id,
            status,
        }: {
            id: number;
            status: "Active" | "Inactive";
        }) => {
            const response = await apiFetch(`/api/entities/business-units/${id}/status`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ status }),
                }
            );
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update status");
            }
            return response.json();
        },
        onSuccess: () => {
            reset();
            queryClient.invalidateQueries({
                queryKey: ["business-units-all", accountId],
            });
            showToast(
                t("messages.status_update_success", { ns: "business_unit" }),
                "success"
            );
        },
        onError: (error: Error) => {
            showToast(
                error.message ||
                t("messages.status_update_error", { ns: "business_unit" }),
                "error"
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async ({
            id,
            reassignToBusinessUnitId,
        }: {
            id: string;
            reassignToBusinessUnitId?: number | null;
        }) => {
            const response = await apiFetch(`/api/entities/business-units/${id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    reassignToBusinessUnitId:
                        reassignToBusinessUnitId || undefined,
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to delete business unit"
                );
            }
            return response.json();
        },
        onSuccess: () => {
            setRefreshKey((prev) => prev + 1);
            reset();
            queryClient.invalidateQueries({
                queryKey: ["business-units-virtual"],
            });
            queryClient.invalidateQueries({
                queryKey: ["business-units", accountId],
            });
            queryClient.invalidateQueries({
                queryKey: ["business-units-all", accountId],
            });
            queryClient.invalidateQueries({ queryKey: ["users"] });
            showToast(
                t("messages.delete_success", { ns: "business_unit" }),
                "success"
            );
            setIsUpsertModalOpen(false);
            setSelectedBusinessUnit(null);
        },
        onError: (error: Error) => {
            showToast(
                error.message ||
                t("messages.delete_error", { ns: "business_unit" }),
                "error"
            );
        },
    });

    const handleBusinessUnitSelect = useCallback(
        (businessUnit: BusinessUnit) => {
            setSelectedBusinessUnit(businessUnit);
            setIsUpsertModalOpen(true);
        },
        []
    );

    const handleModalClose = useCallback(() => {
        const gridElement = document.querySelector(".MuiDataGrid-root");
        if (gridElement instanceof HTMLElement) {
            gridElement.focus();
        }
        setIsUpsertModalOpen(false);
        setSelectedBusinessUnit(null);
    }, []);

    const handleDeleteClick = useCallback((businessUnit: BusinessUnit) => {
        setSelectedBusinessUnit(businessUnit);
        setIsDeleteModalOpen(true);
    }, []);

    const handleDeleteModalClose = useCallback(() => {
        const gridElement = document.querySelector(".MuiDataGrid-root");
        if (gridElement instanceof HTMLElement) {
            gridElement.focus();
        }
        setIsDeleteModalOpen(false);
        setSelectedBusinessUnit(null);
    }, []);

    const confirmDelete = async (reassignToBusinessUnitId?: number | null) => {
        if (!selectedBusinessUnit?.id) return;
        await deleteMutation.mutateAsync({
            id: selectedBusinessUnit.id.toString(),
            reassignToBusinessUnitId,
        });
        handleDeleteModalClose();
    };

    const handleSuccess = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
        reset();
        queryClient.invalidateQueries({ queryKey: ["business-units-virtual"] });
        queryClient.invalidateQueries({
            queryKey: ["business-units", accountId],
        });
        queryClient.invalidateQueries({
            queryKey: ["business-units-all", accountId],
        });
        handleModalClose();
    }, [reset, handleModalClose, queryClient, accountId]);

    const handleAddBusinessUnit = useCallback(() => {
        setSelectedBusinessUnit(null);
        setIsUpsertModalOpen(true);
    }, []);

    const handleStatusToggle = useCallback(
        (businessUnit: BusinessUnit) => {
            const newStatus =
                businessUnit.status === "Active" ? "Inactive" : "Active";
            statusMutation.mutate({ id: businessUnit.id, status: newStatus });
        },
        [statusMutation]
    );

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "name",
                headerName: t("fields.name", { ns: "business_unit" }),
                flex: 1,
                minWidth: 200,
                renderCell: (params) => {
                    const depth = calculateDepth(params.row, allBusinessUnits);
                    const indentSize = depth * 24; // 24px per level

                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                position: "relative",
                                pl:
                                    i18n.language === "he"
                                        ? 0
                                        : `${indentSize}px`,
                                pr:
                                    i18n.language === "he"
                                        ? `${indentSize}px`
                                        : 0,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {depth > 0 && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        left:
                                            i18n.language === "he"
                                                ? "auto"
                                                : `${indentSize - 16}px`,
                                        right:
                                            i18n.language === "he"
                                                ? `${indentSize - 16}px`
                                                : "auto",
                                        width: "12px",
                                        height: "1px",
                                        backgroundColor: theme.palette.divider,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                    }}
                                />
                            )}
                            {hasManageBusinessUnitsPermission ? (
                                <Typography
                                    component="span"
                                    variant="body2"
                                    data-interactive="true"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleBusinessUnitSelect(params.row);
                                    }}
                                    sx={{
                                        fontWeight:
                                            theme.typography.fontWeightMedium,
                                        cursor: "pointer",
                                        color: theme.palette.primary.main,
                                        textDecoration: "underline",
                                        textUnderlineOffset: "0.125em",
                                        "&:hover": {
                                            textDecoration: "underline",
                                            color: theme.palette.primary.dark,
                                        },
                                    }}
                                >
                                    {params.row.name}
                                </Typography>
                            ) : (
                                <Typography variant="body2">
                                    {params.row.name}
                                </Typography>
                            )}
                        </Box>
                    );
                },
            },
            {
                field: "hierarchical",
                headerName: t("fields.level", { ns: "business_unit" }),
                width: 80,
                minWidth: 80,
                sortable: true,
                align: "center",
                headerAlign: "center",
                valueGetter: (params: any) =>
                    params?.row
                        ? calculateDepth(params.row, allBusinessUnits)
                        : 0,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {calculateDepth(params.row, allBusinessUnits)}
                    </Typography>
                ),
            },
            {
                field: "external_id",
                headerName: t("fields.external_id", { ns: "business_unit" }),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.row.external_id || "-"}
                    </Typography>
                ),
            },
            {
                field: "is_primary",
                headerName: t("fields.primary", { ns: "business_unit" }),
                width: 100,
                minWidth: 100,
                sortable: true,
                align: "center",
                headerAlign: "center",
                renderCell: (params) =>
                    params.row.is_primary ? (
                        <CheckIcon
                            sx={{
                                color: "primary.main",
                                fontSize: "1.5rem",
                                fontWeight: "bold",
                                strokeWidth: 2,
                            }}
                        />
                    ) : null,
            },
            {
                field: "parent",
                headerName: t("fields.parent_business_unit", {
                    ns: "business_unit",
                }),
                flex: 1,
                minWidth: 150,
                sortable: true,
                valueGetter: (params: any) => {
                    if (!params?.row) return "";
                    return params.row.Parent?.name || "";
                },
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.row.Parent?.name || "-"}
                    </Typography>
                ),
            },
            {
                field: "status",
                headerName: t("fields.status", { ns: "common" }),
                flex: 1,
                minWidth: 100,
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
                field: "modified_by",
                headerName: t("fields.modified_by", { ns: "common" }),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.row.User_BusinessUnit_modified_byToUser?.name ||
                            params.row.User_BusinessUnit_modified_byToUser
                                ?.email ||
                            "-"}
                    </Typography>
                ),
            },
            {
                field: "modified_at",
                headerName: t("fields.modified_at", { ns: "common" }),
                flex: 1,
                minWidth: 150,
                sortable: true,
                renderCell: (params) => {
                    if (!params.row.modified_at) {
                        return <Typography variant="body2">-</Typography>;
                    }

                    const userLocale = getUserDateLocale(session);
                    const formattedDate = formatDateForDisplay(
                        params.row.modified_at,
                        "datetime",
                        userLocale,
                        getUserTimezone(session)
                    );

                    return (
                        <Typography variant="body2">{formattedDate}</Typography>
                    );
                },
            },
            {
                field: "actions",
                headerName: t("actions.actions", { ns: "common" }),
                sortable: false,
                filterable: false,
                width: 120,
                renderCell: (params) => (
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        {hasManageBusinessUnitsPermission && (
                            <Tooltip
                                title={
                                    params.row.is_primary
                                        ? t("tooltips.cannot_delete_primary", {
                                            ns: "business_unit",
                                        })
                                        : t("tooltips.delete", {
                                            ns: "business_unit",
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
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(params.row);
                                        }}
                                        disabled={params.row.is_primary}
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
                        )}
                    </Box>
                ),
            },
        ],
        [
            t,
            theme,
            handleBusinessUnitSelect,
            handleDeleteClick,
            handleStatusToggle,
            statusMutation.isPending,
            i18n.language,
            session,
            calculateDepth,
            allBusinessUnits,
            hasManageBusinessUnitsPermission,
        ]
    );

    const customButtons = useMemo(
        () =>
            hasManageBusinessUnitsPermission ? (
                <AddBusinessUnitButton onAddClick={handleAddBusinessUnit} />
            ) : null,
        [handleAddBusinessUnit, hasManageBusinessUnitsPermission]
    );

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 200,
                }}
            >
                <CircularProgress color="primary" />
            </Box>
        );
    }

    if (error) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 200,
                    gap: 2,
                }}
            >
                <Typography color="error" variant="body1">
                    {t("messages.error_loading", { ns: "common" })}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                    {error instanceof Error ? error.message : String(error)}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    overflow: "hidden",
                }}
            >
                <EndlessScrollDataGrid
                    key={`business-units-grid-${refreshKey}`}
                    rows={businessUnits || []}
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
                    searchPlaceholder={t("fields.search_placeholder", {
                        ns: "common",
                    })}
                    searchDebounceMs={500}
                    searchDisabled={false}
                    resizableColumns={true}
                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                    language={i18n.language}
                    fillViewport={true}
                    noRowsMessage={t("messages.no_business_units", {
                        ns: "business_unit",
                    })}
                    noRowsDescription={t(
                        "messages.no_business_units_description",
                        { ns: "business_unit" }
                    )}
                />
            </Box>

            <UpsertBusinessUnitModal
                isOpen={isUpsertModalOpen}
                onClose={handleModalClose}
                onSuccess={handleSuccess}
                accountId={accountId}
                businessUnit={selectedBusinessUnit}
            />

            <DeleteBusinessUnitDialog
                isOpen={isDeleteModalOpen}
                onClose={handleDeleteModalClose}
                onConfirm={confirmDelete}
                businessUnitId={selectedBusinessUnit?.id || null}
                accountId={accountId}
                isLoading={deleteMutation.isPending}
                errorMessage={
                    deleteMutation.isError
                        ? deleteMutation.error instanceof Error
                            ? deleteMutation.error.message
                            : t("messages.delete_error", {
                                ns: "business_unit",
                            })
                        : undefined
                }
            />
        </Box>
    );
}
