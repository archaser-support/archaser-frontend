"use client";
import PageHeader from "@/components/PageHeader";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import {
    AddBusiness,
    Delete as DeleteIcon,
    PictureAsPdf as PdfIcon,
    People,
    Restore as RestoreIcon,
} from "@mui/icons-material";
import {
    alpha,
    Box,
    Button,
    Chip,
    IconButton,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    GridColDef,
    GridRenderCellParams,
    GridSortModel,
} from "@mui/x-data-grid";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/app/api";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import { getEndlessScrollToolbarTooltipProps } from "@/shared/layout-components/grid/endlessScrollToolbarTooltip";
import EndlessScrollDataGrid, {
    BREAKPOINTS,
    createQueryFn,
    useVirtualInfiniteScroll,
    useWindowWidth,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { CurrencyColumnsConfig, ExportFormat } from "@/shared/utility/exportToExcel";
import { getNestedValue } from "@/shared/utility/helpers";
import AppUrls from "@/utils/appUrls";

const AccountList: React.FC = () => {
    const { t, i18n } = useTranslation(["accounts", "common"]);
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const theme = useTheme();
    const windowWidth = useWindowWidth();
    const { data: session } = useSession();
    const queryClient = useQueryClient();

    // Search and filter state
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [filterStatus, setFilterStatus] = useState<
        "Active" | "Inactive" | ""
    >("");
    const [deletionFilter, setDeletionFilter] = useState<
        "all" | "active" | "deleted"
    >("active");
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "name", sort: "asc" },
    ]);

    // Deletion state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [confirmationText, setConfirmationText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const prevFilterStatusRef = useRef(filterStatus);
    const prevDeletionFilterRef = useRef(deletionFilter);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Create query key
    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort;
    const queryKey = useMemo(
        () => [
            "customers-virtual",
            {
                query: debouncedSearch,
                status: filterStatus,
                sortField,
                sortDirection,
                deletionFilter,
                version: queryKeyVersion,
            },
        ],
        [
            debouncedSearch,
            filterStatus,
            sortField,
            sortDirection,
            deletionFilter,
            queryKeyVersion,
        ]
    );

    // Use virtual infinite scroll hook
    const {
        data: customers,
        totalRecords,
        isLoading,
        isLoadingMore: _isLoadingMore,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey,
        queryFn: createQueryFn(
            "/api/entities/accounts",
            {
                search: debouncedSearch,
                status: filterStatus,
                sortField: sortModel[0]?.field || "",
                sortDirection: sortModel[0]?.sort || "asc",
                deletionFilter: deletionFilter,
            },
            "accounts"
        ),
    });

    // Reset when search/filter changes (but not for sort changes)
    React.useEffect(() => {
        // Only reset if the values actually changed
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;
        const filterChanged = prevFilterStatusRef.current !== filterStatus;
        const deletionFilterChanged =
            prevDeletionFilterRef.current !== deletionFilter;

        if (searchChanged || filterChanged || deletionFilterChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            prevFilterStatusRef.current = filterStatus;
            prevDeletionFilterRef.current = deletionFilter;
            setQueryKeyVersion((prev) => prev + 1);
            reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, filterStatus, deletionFilter]);

    // Handle page-wide scrolling to scroll the table
    React.useEffect(() => {
        const findScrollableContainer = (): HTMLElement | null => {
            if (!tableContainerRef.current) return null;

            // The scrollable container is a direct child div with overflow-y: auto
            // Look for divs that have overflow styles
            const allDivs =
                tableContainerRef.current.querySelectorAll<HTMLElement>("div");

            for (const div of Array.from(allDivs)) {
                const style = window.getComputedStyle(div);
                // Check if it's scrollable vertically
                if (
                    (style.overflowY === "auto" ||
                        style.overflowY === "scroll") &&
                    div.scrollHeight > div.clientHeight
                ) {
                    return div;
                }
            }
            return null;
        };

        const handleWheel = (e: WheelEvent) => {
            // Only handle vertical scrolling
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                return; // Horizontal scroll, let it pass through
            }

            const container = findScrollableContainer();
            if (!container) return;

            // Check if the table container is visible and in viewport
            const containerRect = container.getBoundingClientRect();
            const isVisible =
                containerRect.top < window.innerHeight &&
                containerRect.bottom > 0 &&
                containerRect.width > 0 &&
                containerRect.height > 0;

            if (!isVisible) return;

            const { scrollTop, scrollHeight, clientHeight } = container;
            const canScrollUp = scrollTop > 0;
            const canScrollDown = scrollTop < scrollHeight - clientHeight;

            // Only intercept scroll if table can scroll in that direction
            const scrollingDown = e.deltaY > 0;
            const scrollingUp = e.deltaY < 0;

            if (
                (scrollingDown && canScrollDown) ||
                (scrollingUp && canScrollUp)
            ) {
                e.preventDefault();
                e.stopPropagation();
                container.scrollTop += e.deltaY;
            }
        };

        // Add wheel event listener with passive: false to allow preventDefault
        window.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            window.removeEventListener("wheel", handleWheel);
        };
    }, []);

    // Check if user is Archaser Admin
    const isArchaserAdmin = session?.user?.account_id === 10013;

    // Deletion handlers
    const handleDeleteClick = (account: any) => {
        setSelectedAccount(account);
        setConfirmationText("");
        setDeleteDialogOpen(true);
    };

    const handleRestoreClick = (account: any) => {
        setSelectedAccount(account);
        setRestoreDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedAccount || confirmationText !== selectedAccount.name) {
            return;
        }

        setIsDeleting(true);
        try {
            await api.delete(`/api/entities/accounts/${selectedAccount.id}`);

            // Close dialog and reset state
            setDeleteDialogOpen(false);
            setSelectedAccount(null);
            setConfirmationText("");

            // Invalidate and refetch all account-related queries
            await queryClient.invalidateQueries({
                queryKey: ["customers-virtual"],
            });
            await queryClient.invalidateQueries({ queryKey: ["account"] });

            // Force a complete refresh
            setQueryKeyVersion((prev) => prev + 1);
            reset();
        } catch (error: any) {
            console.error("Failed to delete account:", error);
            alert(error.response?.data?.error || "Failed to delete account");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleConfirmRestore = async () => {
        if (!selectedAccount) return;

        setIsDeleting(true);
        try {
            await api.put(
                `/api/entities/accounts/${selectedAccount.id}/restore`
            );

            // Close dialog and reset state
            setRestoreDialogOpen(false);
            setSelectedAccount(null);

            // Invalidate and refetch all account-related queries
            await queryClient.invalidateQueries({
                queryKey: ["customers-virtual"],
            });
            await queryClient.invalidateQueries({ queryKey: ["account"] });

            // Force a complete refresh
            setQueryKeyVersion((prev) => prev + 1);
            reset();
        } catch (error: any) {
            console.error("Failed to restore account:", error);
            alert(error.response?.data?.error || "Failed to restore account");
        } finally {
            setIsDeleting(false);
        }
    };

    const calculateGracePeriodDays = (deletedAt: string): number => {
        const deleted = new Date(deletedAt);
        const gracePeriodEnds = new Date(deleted);
        gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 30);

        const now = new Date();
        const diffTime = gracePeriodEnds.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    };

    const handleDownloadGDPRReport = async (
        accountId: number,
        accountName: string
    ) => {
        try {
            const response = await api.get(
                `/api/entities/accounts/${accountId}/gdpr-report`,
                {
                    responseType: "blob",
                }
            );

            // Create a blob URL and trigger download
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `GDPR-Report-${accountName.replace(/[^a-z0-9]/gi, "_")}-${accountId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            // If the response is a blob, try to read it as JSON
            if (error.response?.data instanceof Blob) {
                const text = await error.response.data.text();
                try {
                    const errorData = JSON.parse(text);
                    alert(errorData.error || "Failed to download GDPR report");
                } catch {
                    alert("Failed to download GDPR report: " + text);
                }
            } else {
                alert(
                    error.response?.data?.error ||
                    error.message ||
                    "Failed to download GDPR report"
                );
            }
        }
    };

    // Data transformation
    const mapCustomerToRow = useCallback(
        (customer: any) => ({
            id: customer.id,
            name: customer.name,
            status: customer.status,
            country: getNestedValue(customer, "Country.name") || "",
            state: getNestedValue(customer, "State.name") || "",
            company_number: customer.company_number || "",
            deleted_at: customer.deleted_at,
            raw: customer,
        }),
        []
    );

    // Export handler for accounts
    const handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            try {
                // Use the existing customers data instead of making a new API call
                const rawCustomers = customers || [];

                const transformedCustomers = rawCustomers.map(
                    (customer: any) => {
                        return {
                            id: customer.id,
                            name: customer.name,
                            status: customer.status,
                            country:
                                getNestedValue(customer, "Country.name") || "",
                            state: getNestedValue(customer, "State.name") || "",
                            company_number: customer.company_number || "",
                            raw: customer,
                        };
                    }
                );

                return transformedCustomers;
            } catch (error) {
                console.error("Export failed:", error);
                throw error;
            }
        },
        [customers]
    );

    // Transform data to rows
    const rows = useMemo(() => {
        return customers.map(mapCustomerToRow);
    }, [customers, mapCustomerToRow]);

    // Column definitions
    const columns: GridColDef[] = [
        {
            field: "id",
            headerName: t("fields.id", { ns: "accounts" }),
            flex: 1,
            minWidth: 120,
            sortable: true,
            hideable: true,
            renderCell: (params: GridRenderCellParams) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Typography
                        component="span"
                        variant="body2"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(
                                `/${locale}${AppUrls.ACCOUNT_DETAILS(params.row.id)}`
                            );
                        }}
                        sx={{
                            fontWeight: theme.typography.fontWeightMedium,
                            cursor: "pointer",
                            color: theme.palette.primary.main,
                            "&:hover": {
                                textDecoration: "underline",
                            },
                        }}
                    >
                        {String(params.value)}
                    </Typography>
                </Box>
            ),
        },
        {
            field: "name",
            headerName: t("fields.name", { ns: "accounts" }),
            flex: 1,
            minWidth: 180,
            sortable: true,
            hideable: true,
        },
        {
            field: "status",
            headerName: t("fields.status", { ns: "common" }),
            flex: 1,
            minWidth: 120,
            hideable: true,
            sortable: true,
            renderCell: (params: GridRenderCellParams) => {
                const isDeleted = params.row.deleted_at;

                if (isDeleted) {
                    const gracePeriodDays = calculateGracePeriodDays(
                        params.row.deleted_at
                    );
                    const canRestore = gracePeriodDays > 0;

                    return (
                        <Chip
                            label={
                                canRestore
                                    ? `Deleted (${gracePeriodDays}d)`
                                    : "Anonymized"
                            }
                            size="small"
                            sx={{
                                backgroundColor: canRestore
                                    ? theme.palette.warning.main
                                    : theme.palette.grey[600],
                                color: "white",
                                fontWeight: 500,
                                fontSize: "0.75rem",
                                height: "24px",
                                boxShadow: `0 0 10px ${alpha(canRestore ? theme.palette.warning.main : theme.palette.grey[600], 0.5)}`,
                            }}
                        />
                    );
                }

                const isActive = params.value === "Active";
                return (
                    <Chip
                        label={
                            isActive
                                ? t("values.status_active", { ns: "common" })
                                : t("values.status_inactive", { ns: "common" })
                        }
                        size="small"
                        data-status={isActive ? "active" : "inactive"}
                    />
                );
            },
        },
        {
            field: "country",
            headerName: t("fields.country", { ns: "common" }),
            flex: 1,
            minWidth: 150,
            sortable: true,
            hideable: true,
        },
        {
            field: "state",
            headerName: t("fields.state", { ns: "accounts" }),
            flex: 1,
            minWidth: 150,
            sortable: true,
            hideable: true,
        },
        {
            field: "company_number",
            headerName: t("fields.company_number", { ns: "accounts" }),
            flex: 1,
            minWidth: 150,
            sortable: true,
            hideable: true,
        },
        {
            field: "actions",
            headerName: t("actions.actions", { ns: "common" }),
            sortable: false,
            filterable: false,
            width: 120,
            renderCell: (params: GridRenderCellParams) => {
                const isDeleted = params.row.deleted_at;
                const gracePeriodDays = isDeleted
                    ? calculateGracePeriodDays(params.row.deleted_at)
                    : 0;
                const canRestore = isDeleted && gracePeriodDays > 0;

                if (!isArchaserAdmin) {
                    return null;
                }

                return (
                    <Box
                        sx={{ display: "flex", gap: 0.5, alignItems: "center" }}
                    >
                        {isDeleted ? (
                            <>
                                <Tooltip
                                    title={
                                        canRestore
                                            ? `Restore (${gracePeriodDays} days remaining)`
                                            : "Cannot restore - account has been anonymized"
                                    }
                                >
                                    <span>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                if (canRestore) {
                                                    e.stopPropagation();
                                                    handleRestoreClick(
                                                        params.row.raw
                                                    );
                                                }
                                            }}
                                            color="primary"
                                            disabled={!canRestore}
                                            sx={{
                                                "&.Mui-disabled": {
                                                    color: "text.disabled",
                                                },
                                            }}
                                        >
                                            <RestoreIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                {!canRestore && (
                                    <Tooltip
                                        title={t("messages.gdpr_download_pdf", {
                                            ns: "accounts",
                                        })}
                                    >
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadGDPRReport(
                                                    params.row.id,
                                                    params.row.name
                                                );
                                            }}
                                            color="error"
                                        >
                                            <PdfIcon />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </>
                        ) : (
                            <Tooltip
                                title={t("actions.delete", { ns: "common" })}
                            >
                                <IconButton
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteClick(params.row.raw);
                                    }}
                                    color="primary"
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                );
            },
        },
    ];

    // Status filter component
    const StatusFilterComponent = () => {
        interface FilterOption {
            label: string;
            value: string;
        }

        // Build filter options dynamically based on user role
        const filterOptions: FilterOption[] = isArchaserAdmin
            ? [
                {
                    label: t("values.show_all_accounts", { ns: "accounts" }),
                    value: "",
                },
                {
                    label: t("values.show_active_accounts", {
                        ns: "accounts",
                    }),
                    value: "Active",
                },
                {
                    label: t("values.show_inactive_accounts", {
                        ns: "accounts",
                    }),
                    value: "Inactive",
                },
                {
                    label: t("values.show_deleted_accounts", {
                        ns: "accounts",
                    }),
                    value: "Deleted",
                },
            ]
            : [
                {
                    label: t("values.show_all_accounts", { ns: "accounts" }),
                    value: "",
                },
                {
                    label: t("values.show_active_accounts", {
                        ns: "accounts",
                    }),
                    value: "Active",
                },
                {
                    label: t("values.show_inactive_accounts", {
                        ns: "accounts",
                    }),
                    value: "Inactive",
                },
            ];

        // Create a combined value that represents both status and deletion filter
        const getCombinedValue = () => {
            if (deletionFilter === "deleted") {
                return "Deleted";
            }
            return filterStatus;
        };

        const currentValue =
            filterOptions.find(
                (option) => option.value === getCombinedValue()
            ) || filterOptions[0];

        return (
            <Box
                sx={{
                    display: "flex",
                    gap: theme.spacing(2),
                    alignItems: "center",
                }}
            >
                <Tooltip
                    title={t("actions.add_new_account", { ns: "accounts" })}
                    {...getEndlessScrollToolbarTooltipProps(
                        i18n.language === "he"
                    )}
                >
                    <IconButton
                        color="primary"
                        size="small"
                        type="button"
                        className="toolbar-button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(
                                `/${locale}${AppUrls.ACCOUNT_DETAILS("new")}`
                            );
                        }}
                    >
                        <AddBusiness />
                    </IconButton>
                </Tooltip>

                <ToolbarDropdownFilter<FilterOption>
                    value={currentValue}
                    onChange={(newValue: FilterOption | null) => {
                        const selectedValue = newValue?.value || "";

                        if (selectedValue === "Deleted") {
                            setDeletionFilter("deleted");
                            setFilterStatus("");
                        } else {
                            setDeletionFilter("active");
                            setFilterStatus(
                                selectedValue as "Active" | "Inactive" | ""
                            );
                        }
                    }}
                    options={filterOptions}
                    getOptionLabel={(option: FilterOption) => option.label}
                    isOptionEqualToValue={(
                        option: FilterOption,
                        value: FilterOption
                    ) => option.value === value.value}
                    placeholder={t("fields.status_filter", { ns: "accounts" })}
                />
            </Box>
        );
    };

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
                    {t("messages.error_loading_accounts", { ns: "accounts" })}
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

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                borderRadius: theme.shape.borderRadius,
                position: "relative",
                isolation: "isolate",
            }}
        >
            {/* Header Section */}
            <PageHeader
                title={t("sections.accounts_title", { ns: "accounts" })}
                description={t("sections.manage_your_accounts", {
                    ns: "accounts",
                })}
            />

            {/* Virtual Grid */}
            <Box
                ref={tableContainerRef}
                sx={{
                    position: "relative",
                    isolation: "isolate",
                }}
            >
                <EndlessScrollDataGrid
                    key={`${debouncedSearch}-${filterStatus}`}
                    rows={rows}
                    columns={columns}
                    totalRecords={totalRecords}
                    isLoading={isLoading}
                    onLoadMore={loadMore}
                    hasMore={hasMore}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    customButtons={<StatusFilterComponent />}
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
                    columnVisibilityModel={{
                        id: windowWidth >= BREAKPOINTS.MOBILE,
                        name: windowWidth >= BREAKPOINTS.MOBILE,
                        status: windowWidth >= BREAKPOINTS.MOBILE,
                        country: windowWidth >= BREAKPOINTS.TABLET,
                        state: windowWidth >= BREAKPOINTS.DESKTOP,
                        company_number: windowWidth >= BREAKPOINTS.TABLET,
                    }}
                    noRowsMessage={t("messages.no_accounts_found", {
                        ns: "accounts",
                    })}
                    noRowsDescription={t("messages.no_accounts_description", {
                        ns: "accounts",
                    })}
                    onExport={handleExport}
                    exportContextInfo={{
                        pageName: "accounts",
                        customPrefix: "accounts_export",
                    }}
                    // Currency columns configuration for export splitting (empty for accounts)
                    currencyColumns={{} as CurrencyColumnsConfig}
                />
            </Box>

            {/* Delete Confirmation Dialog */}
            <DeleteDialog
                isOpen={deleteDialogOpen}
                onClose={() => {
                    setDeleteDialogOpen(false);
                    setSelectedAccount(null);
                    setConfirmationText("");
                }}
                onConfirm={handleConfirmDelete}
                title={t("actions.delete_account", { ns: "accounts" })}
                description={
                    <Box>
                        <Typography sx={{ mb: 2 }}>
                            {t("messages.confirm_delete_account", {
                                ns: "accounts",
                                accountName: selectedAccount?.name,
                            })}
                        </Typography>
                        <Typography sx={{ mb: 2, color: "warning.main" }}>
                            {t("messages.this_action_will", { ns: "accounts" })}
                            :
                        </Typography>
                        <Typography component="div" sx={{ mb: 2, pl: 2 }}>
                            •{" "}
                            {t("messages.deactivate_all_users", {
                                ns: "accounts",
                            })}
                            <br />•{" "}
                            {t("messages.anonymize_all_contacts", {
                                ns: "accounts",
                            })}
                            <br />•{" "}
                            {t("messages.delete_all_files", { ns: "accounts" })}
                            <br />•{" "}
                            {t("messages.preserve_financial_records", {
                                ns: "accounts",
                            })}
                            <br />•{" "}
                            {t("messages.grace_period_restoration", {
                                ns: "accounts",
                            })}
                        </Typography>
                        <TextField
                            label={t("messages.type_account_name_confirm", {
                                ns: "accounts",
                            })}
                            value={confirmationText}
                            onChange={(e) =>
                                setConfirmationText(e.target.value)
                            }
                            fullWidth
                            error={
                                confirmationText !== "" &&
                                confirmationText !== selectedAccount?.name
                            }
                            helperText={
                                confirmationText !== "" &&
                                    confirmationText !== selectedAccount?.name
                                    ? t("messages.account_name_mismatch", {
                                        ns: "accounts",
                                    })
                                    : ""
                            }
                        />
                    </Box>
                }
                type="delete"
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={isDeleting}
                confirmDisabled={
                    !selectedAccount ||
                    confirmationText !== selectedAccount?.name
                }
                maxWidth="sm"
            />

            {/* Restore Confirmation Dialog */}
            <DeleteDialog
                isOpen={restoreDialogOpen}
                onClose={() => {
                    setRestoreDialogOpen(false);
                    setSelectedAccount(null);
                }}
                onConfirm={handleConfirmRestore}
                title={t("actions.restore_account", { ns: "accounts" })}
                description={
                    <Box>
                        <Typography sx={{ mb: 2 }}>
                            {t("messages.confirm_restore_account", {
                                ns: "accounts",
                                accountName: selectedAccount?.name,
                            })}
                        </Typography>
                        <Typography sx={{ color: "text.secondary" }}>
                            {t("messages.restore_account_description", {
                                ns: "accounts",
                            })}
                        </Typography>
                    </Box>
                }
                type="info"
                confirmLabel={t("actions.restore_account", { ns: "accounts" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={isDeleting}
                maxWidth="sm"
            />
        </Box>
    );
};

export default AccountList;
