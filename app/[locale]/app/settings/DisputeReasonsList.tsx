"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    Delete as DeleteIcon,
    Gavel as GavelIcon,
    Add as AddIcon,
} from "@mui/icons-material";
import {
    Box,
    IconButton,
    CircularProgress,
    Tooltip,
    Typography,
    Chip,
    Link as MuiLink,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { CurrencyColumnsConfig, ExportFormat } from "@/shared/utility/exportToExcel";
import { formatDateForDisplay } from "@/utils/datetimeOperations";

interface DisputeReason {
    id: number;
    backendId?: number | null;
    name: string;
    status: "Active" | "Inactive";
    account_id: number;
    editable: boolean;
    master_template: boolean;
    modified_at: string;
}

interface DisputeReasonsListProps {
    accountId: number;
}

const AddDisputeReasonIcon = () => {
    const theme = useTheme();
    return (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
            <GavelIcon />
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

// Add Dispute Reason Button Component
const AddDisputeReasonButton = React.memo(
    ({ onAddClick }: { onAddClick: () => void }) => {
        const { t, i18n } = useTranslation(["disputes", "common"]);

        return (
            <Tooltip
                title={t("actions.reasons_add", { ns: "disputes" })}
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
                    <AddDisputeReasonIcon />
                </IconButton>
            </Tooltip>
        );
    }
);

AddDisputeReasonButton.displayName = "AddDisputeReasonButton";

export const DisputeReasonsList: React.FC<DisputeReasonsListProps> = ({
    accountId,
}) => {
    const { t, i18n } = useTranslation(["disputes", "common"]);
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const theme = useTheme();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedDisputeReason, setSelectedDisputeReason] =
        useState<DisputeReason | null>(null);
    const selectedIdRef = useRef<number | null>(null);
    const [listVersion, setListVersion] = useState(0);
    const removedIdsRef = useRef<Set<number>>(new Set());
    const router = useRouter();

    // Date formatting utility aligned with Activity Template table
    const formatModifiedAt = (dateString?: string) => {
        if (!dateString) return "";
        try {
            return formatDateForDisplay(
                dateString,
                "datetime",
                session?.user?.locale,
                session?.user?.timezone
            );
        } catch (e) {
            return "";
        }
    };

    // Search and filter state
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "name", sort: "asc" },
    ]);

    // Create query key
    const queryKey = useMemo(
        () => [
            "dispute-reasons-virtual",
            {
                query: debouncedSearch,
                sortField: sortModel[0]?.field,
                sortDirection: sortModel[0]?.sort,
                accountId: accountId,
            },
        ],
        [debouncedSearch, sortModel[0]?.field, sortModel[0]?.sort, accountId]
    );

    // Use virtual infinite scroll hook
    const {
        data: disputeReasons,
        totalRecords,
        isLoading,
        hasMore,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey,
        queryFn: useCallback(
            async (page: number) => {
                const params = new URLSearchParams({
                    account_id: accountId.toString(),
                    page: page.toString(),
                    limit: "10",
                    sortField: sortModel[0]?.field || "name",
                    sortDirection: sortModel[0]?.sort || "asc",
                });

                // Add search parameter if debounced search exists
                if (debouncedSearch) {
                    params.append("search", debouncedSearch);
                }

                const response = await apiFetch(`/api/operations/dispute-reasons?${params}`
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch dispute reasons");
                }

                const result = await response.json();

                // Transform the API response to match the expected format
                const transformedReasons = (result.disputeReasons || []).map(
                    (reason: any, index: number) => {
                        const backendId = reason.id ?? reason.dispute_reason_id;
                        const numericId =
                            backendId !== undefined && backendId !== null
                                ? Number(backendId)
                                : undefined;

                        return {
                            // Ensure the grid has a stable id
                            id: numericId ?? index + page * 100000,
                            backendId: numericId ?? null,
                            ...reason,
                            User_DisputeReason_modified_byToUser:
                                reason.User_DisputeReason_modified_byToUser,
                        };
                    }
                );

                return {
                    data: transformedReasons,
                    totalRecords: result.totalRecords || 0,
                    hasMore:
                        result.disputeReasons &&
                        result.disputeReasons.length === 10, // Assuming 10 is the limit
                };
            },
            [debouncedSearch, sortModel, accountId]
        ),
    });

    // Note: reset() is not needed here because the queryKey changes when search/sort changes,
    // which automatically triggers a new query through useVirtualInfiniteScroll

    // Export handler for dispute reasons
    const handleExport = useCallback(
        async (
            selectedColumns: string[],
            fileName: string,
            format: ExportFormat
        ) => {
            try {
                // Fetch ALL records for export, not just the loaded ones
                const exportParams = {
                    sortField: sortModel[0]?.field || "",
                    sortDirection: sortModel[0]?.sort || "desc",
                    page: 1,
                    limit: totalRecords || 10000, // Get all records
                };

                // Make API call to fetch all records
                const response = await apiFetch(`/api/operations/dispute-reasons?${new URLSearchParams({
                        account_id: accountId.toString(),
                        page: exportParams.page.toString(),
                        limit: exportParams.limit.toString(),
                    })}`
                );
                if (!response.ok) {
                    throw new Error(
                        `API call failed: ${response.status} ${response.statusText}`
                    );
                }

                const apiData = await response.json();

                // Handle different response formats
                let rawDisputeReasons = [];
                if (Array.isArray(apiData)) {
                    rawDisputeReasons = apiData;
                } else if (
                    apiData.disputeReasons &&
                    Array.isArray(apiData.disputeReasons)
                ) {
                    rawDisputeReasons = apiData.disputeReasons;
                } else {
                    throw new Error("Unexpected API response format");
                }

                const transformedDisputeReasons = rawDisputeReasons.map(
                    (disputeReason: DisputeReason) => {
                        return {
                            id: disputeReason.id,
                            name: disputeReason.name,
                            status: disputeReason.status,
                            raw: disputeReason,
                        };
                    }
                );

                return transformedDisputeReasons;
            } catch (error) {
                console.error("Export failed:", error);
                throw error;
            }
        },
        [sortModel, totalRecords, accountId]
    );

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const response = await apiFetch(`/api/operations/dispute-reasons/${id}`,
                {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                }
            );
            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to delete dispute reason"
                );
            }
            return { success: true };
        },
        onSuccess: (_data, variables) => {
            const deletedId = Number(variables);
            removedIdsRef.current.add(deletedId);
            queryClient.invalidateQueries({
                queryKey: ["dispute-reasons-virtual"],
            });
            // Reset the virtual list to force a fresh fetch from page 1
            reset();
            showToast(
                t("messages.reasons_delete_success", { ns: "disputes" }),
                "success"
            );
            setIsDeleteModalOpen(false);
            setSelectedDisputeReason(null);
            selectedIdRef.current = null;
            // Force re-mount grid to avoid any lingering virtual cache
            setListVersion((v) => v + 1);
        },
        onError: (error: Error) => {
            showToast(
                error.message ||
                    t("messages.reasons_delete_confirm_error", {
                        ns: "disputes",
                    }),
                "error"
            );
        },
    });

    const handleDeleteClick = useCallback((disputeReason: any) => {
        setSelectedDisputeReason(disputeReason);
        // Preserve numeric 0 if it ever occurs; use nullish coalescing only
        const candidateId =
            disputeReason?.backendId ?? disputeReason?.id ?? null;
        selectedIdRef.current = candidateId;
        setIsDeleteModalOpen(true);
    }, []);

    const handleDeleteModalClose = useCallback(() => {
        setIsDeleteModalOpen(false);
        setSelectedDisputeReason(null);
        selectedIdRef.current = null;
    }, []);

    const confirmDelete = async () => {
        const id =
            selectedIdRef.current ??
            selectedDisputeReason?.backendId ??
            selectedDisputeReason?.id ??
            null;
        if (!id) {
            return;
        }
        try {
            await deleteMutation.mutateAsync(Number(id));
        } catch (e) {
            // handled in onError
        }
    };

    const handleAddDisputeReason = useCallback(() => {
        const locale = i18n.language === "he" ? "he" : "en";
        router.push(
            `/${locale}/app/settings/dispute-reasons/create?backUrl=${encodeURIComponent("/app/settings?tab=dispute-reason")}`
        );
    }, [router, i18n.language]);


    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "name",
                headerName: t("fields.reasons_name", { ns: "disputes" }),
                flex: 1,
                minWidth: 200,
                renderCell: (params) => {
                    const disputeReasonId = params.row.id;
                    const locale = i18n.language === "he" ? "he" : "en";
                    const disputeReasonUrl = `/${locale}/app/settings/dispute-reasons/${disputeReasonId}?backUrl=${encodeURIComponent("/app/settings?tab=dispute-reason")}`;
                    return (
                        <MuiLink
                            component={Link}
                            href={disputeReasonUrl}
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
                                }}
                            >
                                {params.row.name}
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
                        {params.row.User_DisputeReason_modified_byToUser?.name ||
                            params.row.User_DisputeReason_modified_byToUser
                                ?.email ||
                            "-"}
                    </Typography>
                ),
            },
            {
                field: "modified_at",
                headerName: t("fields.modified_at", { ns: "common" }),
                flex: 1,
                minWidth: 180,
                renderCell: (params) => {
                    const formatted = formatModifiedAt(params.row.modified_at);
                    if (!formatted) {
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
                    return (
                        <Typography
                            sx={{ fontSize: theme.typography.body2.fontSize }}
                        >
                            {formatted}
                        </Typography>
                    );
                },
            },
            {
                field: "status",
                headerName: t("fields.status", { ns: "common" }),
                flex: 1,
                minWidth: 150,
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
                field: "actions",
                headerName: t("actions.actions", { ns: "common" }),
                sortable: false,
                filterable: false,
                width: 80,
                renderCell: (params) => (
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Tooltip
                            title={
                                !params.row.editable
                                    ? t(
                                          "tooltips.reasons_tooltip_not_editable",
                                          { ns: "disputes" }
                                      )
                                    : params.row.status === "Active"
                                      ? t(
                                            "tooltips.reasons_cannot_delete_active",
                                            { ns: "disputes" }
                                        )
                                      : t("tooltips.reasons_tooltip_delete", {
                                            ns: "disputes",
                                        })
                            }
                            placement="bottom"
                        >
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (
                                            params.row.editable &&
                                            params.row.status !== "Active"
                                        ) {
                                            handleDeleteClick(params.row);
                                        }
                                    }}
                                    disabled={
                                        !params.row.editable ||
                                        params.row.status === "Active"
                                    }
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
        [t, handleDeleteClick]
    );

    const customButtons = useMemo(
        () => <AddDisputeReasonButton onAddClick={handleAddDisputeReason} />,
        [handleAddDisputeReason]
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
                <CircularProgress />
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
                {t("sections.reasons_description", { ns: "disputes" })}
            </Typography>

            <Box
                sx={{
                    width: "100%",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    overflow: "hidden",
                }}
            >
                <EndlessScrollDataGrid
                    key={listVersion}
                    rows={(disputeReasons || []).filter((r: any) => {
                        const rid = r.backendId ?? r.id;
                        return !removedIdsRef.current.has(Number(rid));
                    })}
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
                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                    language={i18n.language}
                    fillViewport={true}
                    resizableColumns={true}
                    noRowsMessage={t("messages.reasons_empty", {
                        ns: "disputes",
                    })}
                    noRowsDescription={t(
                        "messages.try_adjusting_your_filters",
                        { ns: "disputes" }
                    )}
                    onExport={handleExport}
                    exportContextInfo={{
                        pageName: "dispute_reasons",
                        customPrefix: "dispute_reasons_export",
                    }}
                    // Currency columns configuration for export splitting (empty for dispute reasons)
                    currencyColumns={{} as CurrencyColumnsConfig}
                />
            </Box>

            <DeleteDialog
                isOpen={isDeleteModalOpen}
                onClose={handleDeleteModalClose}
                onConfirm={confirmDelete}
                title={t("messages.reasons_delete_confirm_title", {
                    ns: "disputes",
                })}
                description={t("messages.reasons_delete_confirm_description", {
                    ns: "disputes",
                })}
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={deleteMutation.isPending}
                type="delete"
                maxWidth="sm"
                locale={i18n.language}
                errorMessage={
                    deleteMutation.isError
                        ? t("messages.reasons_delete_confirm_error", {
                              ns: "disputes",
                          })
                        : undefined
                }
            />
        </Box>
    );
};
