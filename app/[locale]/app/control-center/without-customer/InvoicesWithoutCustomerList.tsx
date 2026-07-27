"use client";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { DescriptionOutlined as DescriptionOutlinedIcon } from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import api from "@/app/api";
import { getMetricStatCardBorderRadius } from "@/app/theme/metricStatCard";
import EndlessScrollDataGrid, {
    createApiQueryFn,
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { fetchCustomers } from "@/shared/services/customerService";
import {
    CurrencyColumnsConfig,
    ExportFormat,
    formatCurrencyWithCode,
} from "@/shared/utility/exportToExcel";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

interface Invoice {
    id: number;
    invoice_number: string;
    invoice_date: string;
    amount: number;
    status: string;
    customer_id: number | null;
    Customer?: {
        id: number;
        type: string;
        Person?: {
            first_name: string;
            last_name: string;
        };
        Company?: {
            name: string;
        };
    } | null;
}

interface InvoiceResponse {
    invoices: Invoice[];
    totalRecords: number;
}

const InvoicesWithoutCustomerList: React.FC = () => {
    const { t, i18n } = useTranslation([
        "control_center",
        "invoices",
        "customers",
        "common",
    ]);
    const theme = useTheme();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { data: session } = useSession();
    const searchParams = useSearchParams();

    const selectedUserId = searchParams?.get("selectedUserId");

    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "invoice_number", sort: "desc" },
    ]);

    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);

    // Bulk operations state
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkSelectedCustomer, setBulkSelectedCustomer] = useState<any>(null);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const prevSelectedUserIdRef = useRef(selectedUserId);

    // Extract sort field and direction
    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort;

    // Create query key
    const queryKey = useMemo(
        () => [
            "invoices-without-customer-virtual",
            {
                query: debouncedSearch,
                sortField,
                sortDirection,
                selectedUserId: selectedUserId || null,
                version: queryKeyVersion,
            },
        ],
        [
            debouncedSearch,
            sortField,
            sortDirection,
            selectedUserId,
            queryKeyVersion,
        ]
    );

    // Create query function for virtual infinite scroll
    const queryFn = useMemo(
        () =>
            createApiQueryFn(
                async (params: any) => {
                    const queryParams = new URLSearchParams();
                    queryParams.append("page", params.page.toString());
                    queryParams.append("limit", params.limit.toString());
                    if (params.sortField)
                        queryParams.append("sortField", params.sortField);
                    if (params.sortDirection)
                        queryParams.append(
                            "sortDirection",
                            params.sortDirection
                        );
                    if (params.query) queryParams.append("query", params.query);
                    if (params.selectedUserId)
                        queryParams.append(
                            "selectedUserId",
                            params.selectedUserId
                        );

                    const response = await api.get(
                        `/system/control-center?operation=invoices-without-customer&${queryParams.toString()}`
                    );
                    return response.data;
                },
                {
                    search: debouncedSearch,
                    sortField: sortField || "",
                    sortDirection: sortDirection || "desc",
                    selectedUserId: selectedUserId || null,
                },
                "invoices",
                "totalRecords"
            ),
        [debouncedSearch, sortField, sortDirection, selectedUserId]
    );

    // Use virtual infinite scroll hook
    const {
        data: invoices,
        totalRecords,
        isLoading,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll<Invoice>({
        queryKey,
        queryFn,
    });

    // Reset when search/selectedUserId changes
    React.useEffect(() => {
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;
        const selectedUserIdChanged =
            prevSelectedUserIdRef.current !== selectedUserId;

        if (searchChanged || selectedUserIdChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            prevSelectedUserIdRef.current = selectedUserId;

            // Increment version to force new query
            setQueryKeyVersion((prev) => prev + 1);

            // Reset immediately when search or filter changes
            reset();
        }
    }, [debouncedSearch, selectedUserId, reset]);

    // Fetch customers for autocomplete
    const { data: customersData } = useQuery({
        queryKey: ["customer", { page: 1, limit: 1000, query: "" }],
        queryFn: fetchCustomers,
        enabled: isBulkModalOpen,
    });

    const refreshList = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: ["invoices-without-customer"],
        });
    }, [queryClient]);

    const handleBulkAssignCustomer = useCallback(() => {
        setIsBulkModalOpen(true);
        setBulkSelectedCustomer(null);
    }, []);

    const handleBulkUpdateCustomer = useCallback(async () => {
        if (!bulkSelectedCustomer || selectedRows.length === 0) return;

        setIsBulkUpdating(true);
        try {
            const updatePromises = selectedRows.map((invoiceId) =>
                api.put(`/entities/invoices/${invoiceId}`, {
                    customer_id: bulkSelectedCustomer.id,
                })
            );

            await Promise.all(updatePromises);

            showToast(
                t("messages.bulk_customer_updated_successfully", {
                    count: selectedRows.length,
                    ns: "control_center",
                }),
                "success"
            );

            setIsBulkModalOpen(false);
            setSelectedRows([]);
            setBulkSelectedCustomer(null);
            await refreshList();
        } catch (error: any) {
            showToast(
                error.message || t("messages.error", { ns: "control_center" }),
                "error"
            );
        } finally {
            setIsBulkUpdating(false);
        }
    }, [bulkSelectedCustomer, selectedRows, showToast, t, refreshList]);

    const handleCloseBulkModal = useCallback(() => {
        setIsBulkModalOpen(false);
        setBulkSelectedCustomer(null);
    }, []);

    const rows = useMemo(
        () =>
            invoices.map((invoice) => ({
                id: invoice.id,
                checkbox: selectedRows.includes(invoice.id),
                invoice_number: invoice.invoice_number,
                invoice_date: invoice.invoice_date,
                invoice_date_formatted: invoice.invoice_date
                    ? formatDateForDisplay(
                        new Date(invoice.invoice_date),
                        "date",
                        getUserDateLocale(session),
                        getUserTimezone(session)
                    )
                    : "N/A",
                amount: invoice.amount,
                amount_formatted:
                    invoice.amount === 0
                        ? `0.00 USD`
                        : `${formatAmountWithoutSymbol(invoice.amount || 0)} USD`,
                status: invoice.status || "Unknown",
                raw: invoice,
            })),
        [invoices, selectedRows, session?.user?.locale, session?.user?.timezone]
    );

    // Export handler for invoices without customer
    const handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            try {
                // Use the existing invoices data instead of making a new API call
                const rawInvoices = invoices || [];

                const transformedInvoices = rawInvoices.map((invoice: any) => {
                    // Format invoice date
                    const invoiceDateFormatted = invoice.invoice_date
                        ? formatDateForDisplay(
                            new Date(invoice.invoice_date),
                            "date",
                            getUserDateLocale(session),
                            getUserTimezone(session)
                        )
                        : "N/A";

                    // Get currency - try multiple sources
                    const currency =
                        invoice.customer_currency ||
                        invoice.Account?.Country?.currency ||
                        invoice.currency ||
                        "USD"; // Default to USD

                    return {
                        id: invoice.id,
                        invoice_number: invoice.invoice_number,
                        invoice_date: invoiceDateFormatted,
                        amount: formatCurrencyWithCode(
                            invoice.amount || 0,
                            currency
                        ),
                        status: invoice.status || "Unknown",
                        raw: invoice,
                    };
                });

                return transformedInvoices;
            } catch (_error) {
                console.error("Export failed:", _error);
                throw _error;
            }
        },
        [invoices, session?.user?.locale, session?.user?.timezone]
    );

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "checkbox",
                headerName: "",
                width: 100,
                minWidth: 100,
                maxWidth: 100,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                resizable: false,
                pinned: "left",
                renderCell: (params) => (
                    <Checkbox
                        checked={selectedRows.includes(params.row.id)}
                        onChange={(e) => {
                            if (e.target.checked) {
                                setSelectedRows((prev) => [
                                    ...prev,
                                    params.row.id,
                                ]);
                            } else {
                                setSelectedRows((prev) =>
                                    prev.filter((id) => id !== params.row.id)
                                );
                            }
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                        }}
                        sx={{
                            padding: 0,
                            color: theme.palette.primary.main,
                            "&.Mui-checked": {
                                color: theme.palette.primary.main,
                            },
                            "&.MuiCheckbox-indeterminate": {
                                color: theme.palette.primary.main,
                            },
                            "& .MuiSvgIcon-root": {
                                fontSize: theme.spacing(2.5),
                            },
                            "&:hover": {
                                backgroundColor: theme.palette.action.hover,
                            },
                        }}
                    />
                ),
            },
            {
                field: "invoice_number",
                headerName: t("fields.invoice_number", { ns: "invoices" }),
                flex: 1,
                renderCell: (params) => (
                    <Typography
                        component="span"
                        variant="body2"
                        fontWeight={500}
                    >
                        {params.row.invoice_number}
                    </Typography>
                ),
            },
            {
                field: "invoice_date",
                headerName: t("fields.invoice_date", { ns: "invoices" }),
                flex: 1,
                renderCell: (params) => (
                    <Typography component="span" variant="body2">
                        {params.row.invoice_date_formatted}
                    </Typography>
                ),
            },
            {
                field: "amount",
                headerName: t("fields.amount", { ns: "invoices" }),
                flex: 1,
                renderCell: (params) => (
                    <Typography
                        component="span"
                        variant="body2"
                        color={params.row.amount < 0 ? "error" : "textPrimary"}
                        fontWeight={params.row.amount < 0 ? 600 : 400}
                    >
                        {params.row.amount_formatted}
                    </Typography>
                ),
            },
            {
                field: "status",
                headerName: t("fields.status", { ns: "common" }),
                flex: 1,
                renderCell: (params) => (
                    <Typography component="span" variant="body2">
                        {params.row.status}
                    </Typography>
                ),
            },
        ],
        [t, theme, selectedRows]
    );

    const customButtons = useMemo(
        () => (
            <Button
                variant="contained"
                onClick={handleBulkAssignCustomer}
                disabled={selectedRows.length === 0}
                sx={{
                    opacity: selectedRows.length === 0 ? 0.5 : 1,
                    backgroundColor:
                        selectedRows.length === 0
                            ? "action.disabled"
                            : "primary.main",
                    color:
                        selectedRows.length === 0
                            ? "action.disabled"
                            : "primary.contrastText",
                    "&:hover": {
                        backgroundColor:
                            selectedRows.length === 0
                                ? "action.disabled"
                                : "primary.dark",
                    },
                }}
            >
                {t("actions.assign_customer", { ns: "control_center" })}
                {selectedRows.length > 0 && ` (${selectedRows.length})`}
            </Button>
        ),
        [handleBulkAssignCustomer, selectedRows.length, t]
    );

    return (
        <Box
            sx={(theme) => ({
                width: "100%",
                bgcolor: "background.paper",
                borderRadius: getMetricStatCardBorderRadius(theme),
                minHeight: 400,
            })}
        >
            {/* Error state */}
            {error ? (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        minHeight: 400,
                        flexDirection: "column",
                        gap: 2,
                    }}
                >
                    <Typography variant="h6" color="error">
                        {t("messages.error_fetching_data", { ns: "common" })}
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
            ) : isLoading && invoices.length === 0 ? (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "400px",
                    }}
                >
                    <CircularProgress size={40} />
                </Box>
            ) : (
                <Box
                    sx={{
                        position: "relative",
                        isolation: "isolate",
                    }}
                >
                    <EndlessScrollDataGrid
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
                        searchDisabled={false}
                        searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                        noRowsMessage={t("messages.no_invoices", {
                            ns: "control_center",
                        })}
                        noRowsDescription={t(
                            "messages.no_results_description",
                            { ns: "common" }
                        )}
                        language={i18n.language}
                        fillViewport={true}
                        resizableColumns={true}
                        onExport={handleExport}
                        exportContextInfo={{
                            pageName: "invoices_without_customer",
                            customPrefix: "invoices_without_customer_export",
                        }}
                        // Currency columns configuration for export splitting
                        currencyColumns={
                            {
                                amount: {
                                    amountField: "amount_value",
                                    currencyField: "amount_currency",
                                },
                            } as CurrencyColumnsConfig
                        }
                    />
                </Box>
            )}

            {/* Bulk Customer Assignment Modal */}
            <AppDialog
                open={isBulkModalOpen}
                onClose={handleCloseBulkModal}
                drag={false}
                align={false}
                slide={false}
                isRTL={i18n.language === "he"}
                title={
                    <Box sx={{ display: "flex", alignItems: "center", gap: theme.spacing(1) }}>
                        <DescriptionOutlinedIcon aria-hidden="true" />
                        {t("actions.assign_customer", { ns: "control_center" })}
                    </Box>
                }
                titleIcon={null}
                ariaLabelledBy="bulk-assign-customer-modal-title"
                ariaDescribedBy="bulk-assign-customer-modal-description"
                maxWidth="sm"
                fullWidth
                actions={
                    <>
                        <Button
                            onClick={handleCloseBulkModal}
                            variant="outlined"
                            size="small"
                            className="cancel-button"
                            fullWidth={false}
                            disabled={isBulkUpdating}
                            sx={{
                                mr: i18n.language === "he" ? 0 : theme.spacing(1),
                                ml: i18n.language === "he" ? theme.spacing(1) : 0,
                            }}
                        >
                            {t("actions.cancel", { ns: "common" })}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleBulkUpdateCustomer}
                            disabled={!bulkSelectedCustomer || isBulkUpdating}
                            variant="contained"
                            size="small"
                            className="save-button"
                            fullWidth={false}
                            endIcon={
                                isBulkUpdating ? (
                                    <CircularProgress
                                        size={16}
                                        sx={{ color: "inherit" }}
                                    />
                                ) : undefined
                            }
                            sx={{
                                direction: i18n.language === "he" ? "rtl" : "ltr",
                                "& .MuiButton-endIcon": {
                                    marginLeft:
                                        i18n.language === "he" ? 0 : theme.spacing(1),
                                    marginRight:
                                        i18n.language === "he" ? theme.spacing(1) : 0,
                                },
                            }}
                        >
                            {t("actions.update", { ns: "common" })}
                        </Button>
                    </>
                }
            >
                <Box
                    id="bulk-assign-customer-modal-description"
                    component="div"
                    sx={{
                        paddingTop: theme.spacing(2),
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: theme.spacing(1.5),
                            maxWidth: "500px",
                            mx: "auto",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        {/* Customer Selection Section */}
                        <Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: theme.spacing(1),
                                    mb: theme.spacing(0.5),
                                    color: theme.palette.primary.main,
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        textAlign:
                                            i18n.language === "he"
                                                ? "right"
                                                : "left",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    }}
                                >
                                    {t("actions.select_customer", {
                                        ns: "control_center",
                                    })}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    p: {
                                        xs: theme.spacing(0.75),
                                        sm: theme.spacing(1),
                                    },
                                    bgcolor: theme.palette.background.default,
                                    borderRadius: theme.shape.borderRadius,
                                }}
                            >
                                <Autocomplete
                                    key={
                                        isBulkModalOpen
                                            ? "modal-open"
                                            : "modal-closed"
                                    }
                                    value={bulkSelectedCustomer}
                                    onChange={(event, newValue) =>
                                        setBulkSelectedCustomer(newValue)
                                    }
                                    options={customersData?.customers || []}
                                    getOptionLabel={(option) => {
                                        if (option.type === "Person") {
                                            return `${option.Person?.first_name || ""} ${option.Person?.last_name || ""}`.trim();
                                        } else {
                                            return option.Company?.name || "";
                                        }
                                    }}
                                    getOptionKey={(option) => option.id}
                                    isOptionEqualToValue={(option, value) =>
                                        option.id === value?.id
                                    }
                                    filterOptions={(
                                        options,
                                        { inputValue }
                                    ) => {
                                        const searchTerm = inputValue
                                            .toLowerCase()
                                            .trim();
                                        if (!searchTerm) return options;

                                        return options.filter((option) => {
                                            // Search by name
                                            const name =
                                                option.type === "Person"
                                                    ? `${option.Person?.first_name || ""} ${option.Person?.last_name || ""}`
                                                        .trim()
                                                        .toLowerCase()
                                                    : (
                                                        option.Company
                                                            ?.name || ""
                                                    ).toLowerCase();

                                            // Search by customer number (customer_number)
                                            const customerNumber = (
                                                option.customer_number || ""
                                            ).toLowerCase();

                                            return (
                                                name.includes(searchTerm) ||
                                                customerNumber.includes(
                                                    searchTerm
                                                )
                                            );
                                        });
                                    }}
                                    size="small"
                                    dir={i18n.language === "he" ? "rtl" : "ltr"}
                                    {...(i18n.language === "he" && {
                                        "data-hebrew": true,
                                        "data-rtl": true,
                                    })}
                                    selectOnFocus
                                    clearOnBlur={false}
                                    handleHomeEndKeys
                                    renderOption={(props, option) => {
                                        const { key, ...otherProps } = props;
                                        const displayName =
                                            option.type === "Person"
                                                ? `${option.Person?.first_name || ""} ${option.Person?.last_name || ""}`.trim()
                                                : option.Company?.name || "";
                                        return (
                                            <li
                                                key={key}
                                                {...otherProps}
                                                style={{
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    minHeight: "48px",
                                                    padding: "8px 16px",
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 0.5,
                                                        direction:
                                                            i18n.language ===
                                                                "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                        textAlign:
                                                            i18n.language ===
                                                                "he"
                                                                ? "right"
                                                                : "left",
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: 600,
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                            textAlign:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "right"
                                                                    : "left",
                                                        }}
                                                    >
                                                        {displayName}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                            textAlign:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "right"
                                                                    : "left",
                                                        }}
                                                    >
                                                        {(() => {
                                                            const typeTranslation =
                                                                option.type ===
                                                                    "Person"
                                                                    ? t(
                                                                        "values.type_person",
                                                                        {
                                                                            ns: "customers",
                                                                        }
                                                                    )
                                                                    : t(
                                                                        "values.type_company",
                                                                        {
                                                                            ns: "customers",
                                                                        }
                                                                    );
                                                            const customerNumberLabel =
                                                                t(
                                                                    "fields.customer_number",
                                                                    {
                                                                        ns: "customers",
                                                                    }
                                                                );
                                                            return `${typeTranslation} - ${customerNumberLabel}: ${option.customer_number}`;
                                                        })()}
                                                    </Typography>
                                                </Box>
                                            </li>
                                        );
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={t(
                                                "actions.select_customer",
                                                { ns: "control_center" }
                                            )}
                                            variant="outlined"
                                            fullWidth
                                            size="small"
                                            required
                                            error={
                                                !bulkSelectedCustomer &&
                                                isBulkUpdating
                                            }
                                            helperText={
                                                !bulkSelectedCustomer &&
                                                    isBulkUpdating
                                                    ? t(
                                                        "messages.customer_required",
                                                        {
                                                            ns: "control_center",
                                                        }
                                                    )
                                                    : ""
                                            }
                                            {...(i18n.language === "he" && {
                                                "data-hebrew": true,
                                            })}
                                            sx={{
                                                "& .MuiInputBase-input": {
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                },
                                                "& .MuiInputLabel-root": {
                                                    textAlign:
                                                        i18n.language === "he"
                                                            ? "right"
                                                            : "left",
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                },
                                                "& .MuiOutlinedInput-root": {
                                                    alignItems: "center",
                                                },
                                            }}
                                        />
                                    )}
                                />
                            </Box>
                        </Box>

                        {/* Selected Invoices Info Section */}
                        <Box>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: theme.spacing(1),
                                    mb: theme.spacing(0.5),
                                    color: theme.palette.primary.main,
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        textAlign:
                                            i18n.language === "he"
                                                ? "right"
                                                : "left",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    }}
                                >
                                    {t("actions.selected_invoices", {
                                        ns: "control_center",
                                    })}
                                </Typography>
                            </Box>
                            <Box
                                sx={{
                                    p: {
                                        xs: theme.spacing(0.75),
                                        sm: theme.spacing(1),
                                    },
                                    bgcolor: theme.palette.background.default,
                                    borderRadius: theme.shape.borderRadius,
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 500,
                                        color: theme.palette.text.secondary,
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                        textAlign:
                                            i18n.language === "he"
                                                ? "right"
                                                : "left",
                                    }}
                                >
                                    {t("actions.selected_invoices_count", {
                                        count: selectedRows.length,
                                        ns: "control_center",
                                    })}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </AppDialog>
        </Box>
    );
};

export default InvoicesWithoutCustomerList;
