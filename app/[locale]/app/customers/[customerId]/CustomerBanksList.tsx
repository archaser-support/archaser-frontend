import {
    AccountBalance as AccountBalanceIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
} from "@mui/icons-material";
import {
    Box,
    IconButton,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridRenderCellParams } from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import api, { apiFetch } from "@/app/api";
import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { Customer } from "@/types/Customer";
import AddBankToCustomerModal from "./AddBankToCustomerModal";

// No need for a custom interface - report data is dynamic and we can use GridRenderCellParams<any>
// The report execution service returns data with keys like "AccountBankAccounts.bank_name"
// which are accessed dynamically via params.row[key] or params.value

interface CustomerBanksListProps {
    customer: Customer;
}

// Add Bank Button Component
const AddBankButton = React.memo(
    ({
        onAddClick,
        disabled = false,
    }: {
        onAddClick: () => void;
        disabled?: boolean;
    }) => {
        const { t } = useTranslation(["bank_accounts"]);
        const theme = useTheme();

        const tooltipTitle = disabled
            ? t("tooltips.no_available_banks", {
                ns: "bank_accounts",
                defaultValue: "All banks are already assigned to this customer",
            })
            : t("actions.add_account", { ns: "bank_accounts" });

        return (
            <Tooltip title={tooltipTitle}>
                <span>
                    <IconButton
                        color="primary"
                        size="small"
                        className="toolbar-button"
                        onClick={onAddClick}
                        disabled={disabled}
                        aria-label={tooltipTitle}
                    >
                        <Box
                            sx={{
                                position: "relative",
                                display: "inline-flex",
                            }}
                        >
                            <AccountBalanceIcon />
                            <AddIcon
                                sx={{
                                    position: "absolute",
                                    right: -4,
                                    bottom: -4,
                                    fontSize: "0.8rem",
                                    backgroundColor: theme.palette.primary.main,
                                    color: theme.palette.primary.contrastText,
                                    borderRadius: "50%",
                                    padding: "2px",
                                }}
                            />
                        </Box>
                    </IconButton>
                </span>
            </Tooltip>
        );
    }
);

AddBankButton.displayName = "AddBankButton";

const CustomerBanksList: React.FC<CustomerBanksListProps> = ({ customer }) => {
    const { t, i18n } = useTranslation([
        "customers",
        "common",
        "bank_accounts",
        "reports",
    ]);
    const queryClient = useQueryClient();
    const { showToast, success, error: showError } = useToast();
    const theme = useTheme();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedViewId, setSelectedViewId] = useState<number | null>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [hasAvailableBanks, setHasAvailableBanks] = useState(true);

    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        id: number | null;
        row: any | null;
    }>({
        isOpen: false,
        id: null,
        row: null,
    });
    const [isDeleting, setIsDeleting] = useState(false);
    const [viewDeleteConfirmation, setViewDeleteConfirmation] = useState<{
        isOpen: boolean;
        viewId: number | null;
        viewName: string | null;
    }>({
        isOpen: false,
        viewId: null,
        viewName: null,
    });

    // Stable search change handler
    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
    }, []);

    const handleDeleteBank = useCallback((bankId: string, row: any) => {
        setDeleteConfirmation({ isOpen: true, id: parseInt(bankId), row });
    }, []);

    // Handle delete view
    const handleDeleteView = useCallback(
        async (viewId: number) => {
            try {
                const response = await apiFetch(`/api/reports/${viewId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.report?.is_system) {
                        showError(
                            t("reports.messages.cannot_delete_system_report", {
                                defaultValue: "System views cannot be deleted",
                            })
                        );
                        return;
                    }
                    const viewName = data.report?.name || "";
                    setViewDeleteConfirmation({
                        isOpen: true,
                        viewId,
                        viewName,
                    });
                }
            } catch (error) {
                setViewDeleteConfirmation({
                    isOpen: true,
                    viewId,
                    viewName: "",
                });
            }
        },
        [showError, t]
    );

    const handleConfirmDeleteView = useCallback(async () => {
        if (!viewDeleteConfirmation.viewId) return;

        try {
            const response = await apiFetch(`/api/reports/${viewDeleteConfirmation.viewId}`,
                {
                    method: "DELETE",
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete view");
            }

            if (selectedViewId === viewDeleteConfirmation.viewId) {
                setSelectedViewId(null);
            }

            await queryClient.invalidateQueries({
                queryKey: ["reports-list"],
            });

            setViewDeleteConfirmation({
                isOpen: false,
                viewId: null,
                viewName: null,
            });
            success(
                t("reports.messages.delete_report_success", {
                    defaultValue: "View deleted successfully",
                })
            );
        } catch (error) {
            showError(
                error instanceof Error
                    ? error.message
                    : t("reports.messages.delete_report_error", {
                        defaultValue: "Failed to delete view",
                    })
            );
        }
    }, [
        viewDeleteConfirmation,
        selectedViewId,
        queryClient,
        success,
        showError,
        t,
    ]);

    const handleCancelDeleteView = useCallback(() => {
        setViewDeleteConfirmation({
            isOpen: false,
            viewId: null,
            viewName: null,
        });
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!deleteConfirmation.id || !deleteConfirmation.row) {
            return;
        }

        setIsDeleting(true);
        // The API expects: /customer-banks/{customerId}/{customerBankRecordId}
        // where customerBankRecordId is CustomerBanks.id (the customer bank record ID)
        // Use the row data directly from the action handler to avoid stale data issues
        const row = deleteConfirmation.row;

        // Get CustomerBanks.id from the row (this is the customer bank record ID)
        // The report execution service formats fields as "Table.field" (e.g., "CustomerBanks.id")
        // The row.id should be CustomerBanks.id since that's the primary table
        const customerBankRecordId =
            row?.id !== undefined
                ? (typeof row.id === 'string'
                    ? parseInt(row.id, 10)
                    : row.id)
                : row?.["CustomerBanks.id"] !== undefined
                    ? (typeof row["CustomerBanks.id"] === 'string'
                        ? parseInt(row["CustomerBanks.id"], 10)
                        : row["CustomerBanks.id"])
                    : null;

        if (!customerBankRecordId) {
            // This should never happen if the report config is correct and data is valid
            // Log the error for debugging with flattened structure
            const availableKeys = row ? Object.keys(row) : [];
            const allValues = row ? availableKeys.reduce((acc, key) => {
                acc[`key_${key}`] = row[key];
                return acc;
            }, {} as Record<string, any>) : {};

            console.error('[CustomerBanksList] Missing CustomerBanks.id in row data:', {
                deleteConfirmationRowId: deleteConfirmation.id,
                deleteConfirmationRowIdType: typeof deleteConfirmation.id,
                deleteConfirmationRowIdValue: deleteConfirmation.id,
                hasRow: !!row,
                availableKeys,
                availableKeysCount: availableKeys.length,
                rowId: row?.id,
                rowIdType: row?.id ? typeof row.id : 'undefined',
                customerBanksIdKey: row?.["CustomerBanks.id"],
                allRowValues: allValues,
            });
            showToast(
                t("messages.delete_error", { ns: "bank_accounts" }) +
                " (Missing customer bank record ID)",
                "error"
            );
            setIsDeleting(false);
            return;
        }

        const apiUrl = `/entities/customer-banks/${customer.id}/${customerBankRecordId}`;

        try {
            await api.delete(apiUrl);

            // Invalidate view execution queries
            await queryClient.invalidateQueries({
                queryKey: ["view-execution"],
            });
            // Also invalidate customer-banks-relationships query used by the modal and button state
            await queryClient.invalidateQueries({
                queryKey: ["customer-banks-relationships", customer.id],
            });
            // Invalidate bank-accounts query to update button state
            await queryClient.invalidateQueries({
                queryKey: ["bank-accounts", customer.account_id],
            });

            showToast(
                t("messages.delete_success", { ns: "bank_accounts" }),
                "success"
            );
            setDeleteConfirmation({ isOpen: false, id: null, row: null });
        } catch (_error) {
            showToast(
                t("messages.delete_error", { ns: "bank_accounts" }),
                "error"
            );
        } finally {
            setIsDeleting(false);
        }
    }, [
        deleteConfirmation.id,
        deleteConfirmation.row,
        customer.id,
        showToast,
        t,
        queryClient,
    ]);

    // Custom cell renderers for nested fields
    // Note: The report execution service formats data with keys like "AccountBankAccounts.bank_name"
    // The data is flattened, so we access values directly from params.value or params.row
    const customCellRenderers = useMemo(
        () => ({
            // Handle both "AccountBankAccounts.bank_name" and "bank_name" (if alias is used)
            "AccountBankAccounts.bank_name": (params: GridRenderCellParams<any>) => {
                const value = params.value || params.row?.["AccountBankAccounts.bank_name"] || "";
                return (
                    <Typography variant="body2" className="truncate w-full">
                        {value || "-"}
                    </Typography>
                );
            },
            bank_name: (params: GridRenderCellParams<any>) => {
                const value = params.value || params.row?.["AccountBankAccounts.bank_name"] || params.row?.bank_name || "";
                return (
                    <Typography variant="body2" className="truncate w-full">
                        {value || "-"}
                    </Typography>
                );
            },
            // Handle country field (with alias)
            country: (params: GridRenderCellParams<any>) => {
                const value = params.value || params.row?.country || params.row?.["Country.name"] || "";
                return (
                    <Typography variant="body2" className="truncate w-full">
                        {value || "-"}
                    </Typography>
                );
            },
            "Country.name": (params: GridRenderCellParams<any>) => {
                const value = params.value || params.row?.["Country.name"] || params.row?.country || "";
                return (
                    <Typography variant="body2" className="truncate w-full">
                        {value || "-"}
                    </Typography>
                );
            },
            // Handle city
            "AccountBankAccounts.city": (params: GridRenderCellParams<any>) => {
                const value = params.value || params.row?.["AccountBankAccounts.city"] || "";
                return (
                    <Typography variant="body2" className="truncate w-full">
                        {value || "-"}
                    </Typography>
                );
            },
            city: (params: GridRenderCellParams<any>) => {
                const value = params.value || params.row?.["AccountBankAccounts.city"] || params.row?.city || "";
                return (
                    <Typography variant="body2" className="truncate w-full">
                        {value || "-"}
                    </Typography>
                );
            },
            // Handle account_number
            "AccountBankAccounts.account_number": (params: GridRenderCellParams<any>) => {
                const value = params.value || params.row?.["AccountBankAccounts.account_number"] || "";
                return (
                    <Typography variant="body2" className="truncate w-full">
                        {value || "-"}
                    </Typography>
                );
            },
            account_number: (params: GridRenderCellParams<any>) => {
                const value = params.value || params.row?.["AccountBankAccounts.account_number"] || params.row?.account_number || "";
                return (
                    <Typography variant="body2" className="truncate w-full">
                        {value || "-"}
                    </Typography>
                );
            },
            // Handle beneficiary_name
            "AccountBankAccounts.beneficiary_name": (params: GridRenderCellParams<any>) => {
                const value = params.value || params.row?.["AccountBankAccounts.beneficiary_name"] || "";
                return (
                    <Typography variant="body2" className="truncate w-full">
                        {value || "-"}
                    </Typography>
                );
            },
            beneficiary_name: (params: GridRenderCellParams<any>) => {
                const value = params.value || params.row?.["AccountBankAccounts.beneficiary_name"] || params.row?.beneficiary_name || "";
                return (
                    <Typography variant="body2" className="truncate w-full">
                        {value || "-"}
                    </Typography>
                );
            },
        }),
        []
    );

    // Actions column renderer
    const actionsColumnRenderer = useCallback(
        (params: GridRenderCellParams<any>) => {
            return (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Tooltip
                        title={t("tooltips.delete", {
                            ns: "bank_accounts",
                        })}
                    >
                        <IconButton
                            size="small"
                            onClick={() => handleDeleteBank(params.row.id, params.row)}
                            sx={{
                                color: "rgb(var(--primary-rgb))",
                                "&:hover": {
                                    backgroundColor:
                                        "rgba(var(--primary-rgb), 0.08)",
                                },
                            }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            );
        },
        [t, handleDeleteBank]
    );

    const handleOpenModal = useCallback(() => {
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    const handleAddBankSuccess = useCallback(async () => {
        // Invalidate view execution queries to refresh the list
        // This will cause ViewBasedDataGrid to refetch and update the rows
        await queryClient.invalidateQueries({
            queryKey: ["view-execution"],
        });
        // Also invalidate customer-banks-relationships query used by the modal and button state
        await queryClient.invalidateQueries({
            queryKey: ["customer-banks-relationships", customer.id],
        });
        // Invalidate bank-accounts query to update button state
        await queryClient.invalidateQueries({
            queryKey: ["bank-accounts", customer.account_id],
        });
    }, [queryClient, customer.id, customer.account_id]);

    const handleAvailableBanksChange = useCallback((hasAvailable: boolean) => {
        setHasAvailableBanks(hasAvailable);
    }, []);

    // Fetch customer's bank relationships to calculate available banks count
    // This ensures the button state updates even when modal is closed
    const { data: customerBanksForButton } = useQuery({
        queryKey: ["customer-banks-relationships", customer.id],
        queryFn: async () => {
            const response = await api.get(
                `/entities/customer-banks/${customer.id}?limit=1000`
            );
            return response.data;
        },
        enabled: !!customer.id,
        staleTime: 30 * 1000, // Cache for 30 seconds
    });

    // Fetch all available banks to calculate if any are left to assign
    const { data: allBanksData } = useQuery({
        queryKey: ["bank-accounts", customer.account_id],
        queryFn: async () => {
            const response = await api.get(
                `/bank-accounts?accountId=${customer.account_id}&include=Country`
            );
            return response.data;
        },
        enabled: !!customer.account_id,
        staleTime: 5 * 60 * 1000,
    });

    // Calculate available banks count to update button state
    // This runs independently of the modal, so button state updates after add/delete
    useEffect(() => {
        if (!allBanksData || !Array.isArray(allBanksData)) {
            setHasAvailableBanks(true); // Assume available if we can't determine
            return;
        }

        const assignedBankAccountIds = new Set<string | number>();
        if (customerBanksForButton?.data && Array.isArray(customerBanksForButton.data)) {
            customerBanksForButton.data.forEach((customerBank: any) => {
                const bankAccountId =
                    customerBank.customer_bank_account_id ??
                    customerBank["customer_bank_account_id"];

                if (bankAccountId !== undefined && bankAccountId !== null) {
                    assignedBankAccountIds.add(String(bankAccountId));
                    const numId = Number(bankAccountId);
                    if (!isNaN(numId)) {
                        assignedBankAccountIds.add(numId);
                    }
                }
            });
        }

        const availableCount = allBanksData.filter((bank: { id?: number | string }) => {
            if (!bank.id) return false;
            const bankIdStr = String(bank.id);
            const bankIdNum = Number(bank.id);
            return !assignedBankAccountIds.has(bankIdStr) &&
                !(isNaN(bankIdNum) ? false : assignedBankAccountIds.has(bankIdNum));
        }).length;

        setHasAvailableBanks(availableCount > 0);
    }, [allBanksData, customerBanksForButton, customer.id, customer.account_id]);

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                borderRadius: theme.shape.borderRadius,
                position: "relative",
                mt: { xs: 2, sm: 2 },
            }}
        >
            {/* Header Section */}
            <Box
                sx={{
                    p: { xs: 1, sm: 1.25 },
                    mb: theme.spacing(1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AccountBalanceIcon
                        sx={{
                            color: "primary.main",
                            fontSize: { xs: 18, sm: 20 },
                        }}
                    />
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 500,
                            fontSize: { xs: "1rem", sm: "1.25rem" },
                        }}
                    >
                        {t("sections.relevant_bank_accounts", {
                            ns: "customers",
                        })}
                    </Typography>
                </Box>
            </Box>

            {/* Virtual Grid */}
            <Box
                sx={{
                    position: "relative",
                    isolation: "isolate",
                }}
            >
                <ViewBasedDataGrid
                    context="customer_banks"
                    searchValue={search}
                    onSearchChange={handleSearchChange}
                    customButtons={
                        <AddBankButton
                            onAddClick={handleOpenModal}
                            disabled={!hasAvailableBanks}
                        />
                    }
                    additionalFilters={useMemo(
                        () => [
                            {
                                table: "CustomerBanks",
                                field: "customer_id",
                                operator: "equals",
                                value: customer.id,
                            },
                        ],
                        [customer.id]
                    )}
                    customCellRenderers={customCellRenderers}
                    actionsColumn={actionsColumnRenderer}
                    actionsColumnConfig={{
                        headerName: t("actions.actions", { ns: "common" }),
                        flex: 0,
                        minWidth: 120,
                    }}
                    onViewChange={setSelectedViewId}
                    onRowsChange={setRows}
                    onDeleteView={handleDeleteView}
                    exportDisabled={false}
                    allowAddEditViews={false}
                />
            </Box>

            <AddBankToCustomerModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                customer={customer}
                existingCustomerBanks={rows}
                onSuccess={handleAddBankSuccess}
                onAvailableBanksChange={handleAvailableBanksChange}
            />

            <DeleteDialog
                isOpen={deleteConfirmation.isOpen}
                onClose={() => {
                    if (!isDeleting) {
                        setDeleteConfirmation({ isOpen: false, id: null, row: null });
                    }
                }}
                onConfirm={confirmDelete}
                title={t("messages.delete_confirm_title", { ns: "bank_accounts" })}
                description={t("messages.delete_confirm_description", {
                    ns: "bank_accounts",
                })}
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={isDeleting}
                type="delete"
                locale={i18n.language}
            />
            {/* Delete View Confirmation Dialog */}
            <DeleteDialog
                isOpen={viewDeleteConfirmation.isOpen}
                onClose={handleCancelDeleteView}
                onConfirm={handleConfirmDeleteView}
                title={t("reports.actions.delete_report", {
                    defaultValue: "Delete View",
                })}
                description={
                    viewDeleteConfirmation.viewName
                        ? t("reports.messages.delete_report_confirmation", {
                            defaultValue:
                                "Are you sure you want to delete this view?",
                        }) + ` "${viewDeleteConfirmation.viewName}"?`
                        : t("reports.messages.delete_report_confirmation", {
                            defaultValue:
                                "Are you sure you want to delete this view?",
                        })
                }
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                type="delete"
                locale={i18n.language}
            />
        </Box >
    );
};

export default CustomerBanksList;
