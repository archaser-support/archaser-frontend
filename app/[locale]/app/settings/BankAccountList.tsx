"use client";

import {
    Delete as DeleteIcon,
    AccountBalance as AccountBalanceIcon,
    Add as AddIcon,
} from "@mui/icons-material";
import {
    Box,
    IconButton,
    CircularProgress,
    Tooltip,
    Typography,
    Chip,
} from "@mui/material";
import Button from "@mui/material/Button";
import { useTheme } from "@mui/material/styles";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useSession } from "next-auth/react";
import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
    createQueryFn,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { CurrencyColumnsConfig, ExportFormat } from "@/shared/utility/exportToExcel";
import { getNestedValue } from "@/shared/utility/helpers";

import { UpsertBankModal } from "./UpsertBankModal";

interface BankAccount {
    id: number;
    created_at: Date;
    modified_at: Date;
    account_id: number;
    bank_name: string;
    account_number: string;
    beneficiary_name: string;
    primary: boolean;
    status: boolean;
    Country?: {
        name: string;
    };
}

interface BankAccountListProps {
    accountId: number;
}

const rowsPerPage = 10;

const AddBankIcon = () => {
    const theme = useTheme();
    return (
        <Box sx={{ position: "relative", display: "inline-flex" }}>
            <AccountBalanceIcon />
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

// Add Bank Button Component
const AddBankButton = React.memo(
    ({
        onAddClick,
        hasPermission,
    }: {
        onAddClick: () => void;
        hasPermission: boolean;
    }) => {
        const { t, i18n } = useTranslation(["bank_accounts", "common"]);

        if (!hasPermission) {
            return null;
        }

        return (
            <Tooltip
                title={t("actions.add_account", { ns: "bank_accounts" })}
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
                    <AddBankIcon />
                </IconButton>
            </Tooltip>
        );
    }
);

AddBankButton.displayName = "AddBankButton";

export function BankAccountList({ accountId }: BankAccountListProps) {
    const { t, i18n } = useTranslation(["bank_accounts", "common"]);
    const theme = useTheme();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { data: session } = useSession();

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
    const hasEditBankAccountPermission =
        userPermissions.includes("edit_bank_account");
    const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedBankAccount, setSelectedBankAccount] =
        useState<BankAccount | null>(null);
    const [refreshKey, setRefreshKey] = useState(0); // Add refresh key to force re-render

    // Search and filter state
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "bank_name", sort: "asc" },
    ]);

    // Create query key
    const queryKey = useMemo(
        () => [
            "bank-accounts-virtual",
            {
                query: debouncedSearch,
                sortField: sortModel[0]?.field,
                sortDirection: sortModel[0]?.sort,
                accountId: accountId,
                refreshKey, // Add refresh key to force fresh query
            },
        ],
        [
            debouncedSearch,
            sortModel[0]?.field,
            sortModel[0]?.sort,
            accountId,
            refreshKey,
        ]
    );

    // Use virtual infinite scroll hook
    const {
        data: bankAccounts,
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
            const response = await fetch(
                `/api/entities/accounts/${accountId}/bank-accounts?${new URLSearchParams(
                    {
                        page: page.toString(),
                        limit: "10",
                        sortField: sortModel[0]?.field || "bank_name",
                        sortDirection: sortModel[0]?.sort || "asc",
                        include: "Country",
                    }
                )}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch bank accounts");
            }

            const result = await response.json();

            // Transform the API response to match the expected format
            return {
                data: result.data || [],
                totalRecords: result.total || 0,
                hasMore: result.data && result.data.length === 10, // Assuming 10 is the limit
            };
        },
    });

    // Note: reset() is not needed here because the queryKey changes when search/sort changes,
    // which automatically triggers a new query through useVirtualInfiniteScroll

    // Export handler for bank accounts
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
                const response = await apiFetch(`/api/entities/bank-accounts?${new URLSearchParams({
                        sortField: exportParams.sortField,
                        sortDirection: exportParams.sortDirection,
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
                let rawBankAccounts = [];
                if (Array.isArray(apiData)) {
                    rawBankAccounts = apiData;
                } else if (
                    apiData.bankAccounts &&
                    Array.isArray(apiData.bankAccounts)
                ) {
                    rawBankAccounts = apiData.bankAccounts;
                } else if (apiData.data && Array.isArray(apiData.data)) {
                    rawBankAccounts = apiData.data;
                } else {
                    throw new Error("Unexpected API response format");
                }

                const transformedBankAccounts = rawBankAccounts.map(
                    (bankAccount: BankAccount) => {
                        return {
                            id: bankAccount.id,
                            country:
                                getNestedValue(bankAccount, "Country.name") ||
                                "",
                            bank_name: bankAccount.bank_name,
                            account_number: bankAccount.account_number,
                            beneficiary_name:
                                bankAccount.beneficiary_name || "",
                            primary: bankAccount.primary,
                            status: bankAccount.status,
                            raw: bankAccount,
                        };
                    }
                );

                return transformedBankAccounts;
            } catch (error) {
                console.error("Export failed:", error);
                throw error;
            }
        },
        [sortModel, totalRecords]
    );

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await apiFetch(`/api/entities/accounts/${accountId}/bank-accounts/${id}`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.message || "Failed to delete bank account"
                );
            }
            return response.json();
        },
        onSuccess: () => {
            reset();
            showToast(
                t("messages.delete_success", { ns: "bank_accounts" }),
                "success"
            );
            setIsUpsertModalOpen(false);
            setSelectedBankAccount(null);
        },
        onError: () => {
            showToast(
                t("messages.delete_error", { ns: "bank_accounts" }),
                "error"
            );
        },
    });

    const handleBankAccountSelect = useCallback((bankAccount: BankAccount) => {
        setSelectedBankAccount(bankAccount);
        setIsUpsertModalOpen(true);
    }, []);

    const handleModalClose = useCallback(() => {
        // Reset focus to the grid after modal closes
        const gridElement = document.querySelector(".MuiDataGrid-root");
        if (gridElement instanceof HTMLElement) {
            gridElement.focus();
        }
        setIsUpsertModalOpen(false);
        setSelectedBankAccount(null);
    }, []);

    const handleDeleteClick = useCallback((bankAccount: BankAccount) => {
        setSelectedBankAccount(bankAccount);
        setIsDeleteModalOpen(true);
    }, []);

    const handleDeleteModalClose = useCallback(() => {
        // Reset focus to the grid after modal closes
        const gridElement = document.querySelector(".MuiDataGrid-root");
        if (gridElement instanceof HTMLElement) {
            gridElement.focus();
        }
        setIsDeleteModalOpen(false);
        setSelectedBankAccount(null);
    }, []);

    const confirmDelete = async () => {
        if (!selectedBankAccount?.id) return;
        await deleteMutation.mutateAsync(selectedBankAccount.id.toString());
        handleDeleteModalClose();
    };

    const handleSuccess = useCallback(() => {
        // Increment refresh key to force new query key
        setRefreshKey((prev) => prev + 1);

        // Reset and refetch
        reset();

        // Close modal
        handleModalClose();
    }, [reset, handleModalClose]);

    const handleAddBank = useCallback(() => {
        setSelectedBankAccount(null);
        setIsUpsertModalOpen(true);
    }, []);

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "country",
                headerName: t("fields.country", { ns: "common" }),
                flex: 1,
                minWidth: 120,
                valueGetter: (params: any) => {
                    if (!params?.row) return "";
                    return params.row.Country?.name || "";
                },
                renderCell: (params) => {
                    if (!params?.row) return null;
                    const countryName = params.row.Country?.name || "";
                    if (!hasEditBankAccountPermission) {
                        return (
                            <Typography variant="body2">
                                {countryName}
                            </Typography>
                        );
                    }
                    return (
                        <Typography
                            component="span"
                            variant="body2"
                            data-interactive="true"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleBankAccountSelect(params.row);
                            }}
                            sx={{
                                fontWeight: theme.typography.fontWeightMedium,
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
                            {countryName}
                        </Typography>
                    );
                },
                sortComparator: (v1, v2) => {
                    return (v1 || "").localeCompare(v2 || "");
                },
            },
            {
                field: "bank_name",
                headerName: t("fields.bank_name", { ns: "bank_accounts" }),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.row.bank_name}
                    </Typography>
                ),
            },
            {
                field: "account_number",
                headerName: t("fields.account_number", { ns: "bank_accounts" }),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.row.account_number}
                    </Typography>
                ),
            },
            {
                field: "beneficiary_name",
                headerName: t("fields.beneficiary_name", {
                    ns: "bank_accounts",
                }),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.row.beneficiary_name || ""}
                    </Typography>
                ),
            },
            {
                field: "primary",
                headerName: t("fields.primary", { ns: "bank_accounts" }),
                flex: 1,
                minWidth: 100,
                renderCell: (params) => (
                    <Chip
                        label={
                            params.row.primary
                                ? t("fields.yes", { ns: "common" })
                                : t("fields.no", { ns: "common" })
                        }
                        size="small"
                        data-status={params.row.primary ? "active" : "inactive"}
                    />
                ),
            },
            {
                field: "status",
                headerName: t("fields.status", { ns: "common" }),
                flex: 1,
                minWidth: 100,
                renderCell: (params) => {
                    const isActive = params.row.status === true;
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
                width: 120,
                renderCell: (params) => (
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        {hasEditBankAccountPermission && (
                            <Tooltip
                                title={
                                    params.row.primary
                                        ? t("tooltips.cannot_delete_primary", {
                                              ns: "bank_accounts",
                                          })
                                        : t("tooltips.delete", {
                                              ns: "bank_accounts",
                                          })
                                }
                                placement="bottom"
                            >
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(params.row);
                                        }}
                                        disabled={params.row.primary}
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
            handleBankAccountSelect,
            handleDeleteClick,
            hasEditBankAccountPermission,
        ]
    );

    const customButtons = useMemo(
        () => (
            <AddBankButton
                onAddClick={handleAddBank}
                hasPermission={hasEditBankAccountPermission}
            />
        ),
        [handleAddBank, hasEditBankAccountPermission]
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
                <CircularProgress color="primary" size={40} />
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
                {t("fields.description", { ns: "bank_accounts" })}
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
                    key={`bank-accounts-grid-${refreshKey}`}
                    rows={bankAccounts || []}
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
                    noRowsMessage={t("messages.no_accounts", {
                        ns: "bank_accounts",
                    })}
                    noRowsDescription={t("messages.no_accounts_description", {
                        ns: "bank_accounts",
                    })}
                    onExport={handleExport}
                    exportContextInfo={{
                        pageName: "bank_accounts",
                        customPrefix: "bank_accounts_export",
                    }}
                    // Currency columns configuration for export splitting (empty for bank accounts)
                    currencyColumns={{} as CurrencyColumnsConfig}
                />
            </Box>

            <UpsertBankModal
                isOpen={isUpsertModalOpen}
                onClose={handleModalClose}
                onSuccess={handleSuccess}
                accountId={accountId}
                account={selectedBankAccount}
            />

            <DeleteDialog
                isOpen={isDeleteModalOpen}
                onClose={handleDeleteModalClose}
                onConfirm={confirmDelete}
                title={t("messages.delete_confirm_title", {
                    ns: "bank_accounts",
                })}
                description={t("messages.delete_confirm_description", {
                    ns: "bank_accounts",
                })}
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={deleteMutation.isPending}
                type="delete"
                maxWidth="sm"
                locale={i18n.language}
                errorMessage={
                    deleteMutation.isError
                        ? t("messages.delete_error", { ns: "bank_accounts" })
                        : undefined
                }
            />
        </Box>
    );
}
