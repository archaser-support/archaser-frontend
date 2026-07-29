"use client";
import { CircularProgress, Button, Tooltip, useTheme } from "@mui/material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";
import { PersonAdd } from "@mui/icons-material";
import AppUrls from "@/utils/appUrls";

import UpsertContactModal from "@/app/[locale]/app/customers/[customerId]/UpsertContactModal";
import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
    createApiQueryFn,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import api from "@/app/api";
import { getMetricStatCardBorderRadius } from "@/app/theme/metricStatCard";
import {
    formatCurrencyWithCode,
    CurrencyColumnsConfig,
    ExportFormat,
} from "@/shared/utility/exportToExcel";
import { getNestedValue } from "@/shared/utility/helpers";
import { useAccountClientType } from "@/shared/hooks/useAccountClientType";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

const CustomersWithoutContactList: React.FC = () => {
    const clientType = useAccountClientType();
    const { t, i18n } = useTranslation([
        "control_center",
        "customers",
        "common",
        "contacts",
    ]);
    const theme = useTheme();
    const queryClient = useQueryClient();
    const { showToast: _showToast } = useToast();
    const searchParams = useSearchParams();

    const selectedUserId = searchParams?.get("selectedUserId");

    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "name", sort: "asc" },
    ]);

    const [filterStatus, setFilterStatus] = useState<"Active" | "Inactive">(
        "Active"
    );
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
        null
    );
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(
        null
    );

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const prevFilterStatusRef = useRef(filterStatus);
    const prevSelectedUserIdRef = useRef(selectedUserId);

    // Extract sort field and direction
    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort;

    // Create query key
    const queryKey = useMemo(
        () => [
            "customers-without-contact-virtual",
            {
                query: debouncedSearch,
                status: filterStatus,
                sortField,
                sortDirection,
                selectedUserId: selectedUserId || null,
                version: queryKeyVersion,
            },
        ],
        [
            debouncedSearch,
            filterStatus,
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
                    if (params.status)
                        queryParams.append("status", params.status);
                    if (params.query) queryParams.append("query", params.query);
                    if (params.selectedUserId)
                        queryParams.append(
                            "selectedUserId",
                            params.selectedUserId
                        );

                    const response = await api.get(
                        `/system/control-center?operation=customers-without-contact&${queryParams.toString()}`
                    );
                    return response.data;
                },
                {
                    search: debouncedSearch,
                    status: filterStatus,
                    sortField: sortField || "",
                    sortDirection: sortDirection || "asc",
                    selectedUserId: selectedUserId || null,
                },
                "customers",
                "totalRecords"
            ),
        [
            debouncedSearch,
            filterStatus,
            sortField,
            sortDirection,
            selectedUserId,
        ]
    );

    // Use virtual infinite scroll hook
    const {
        data: customers,
        totalRecords,
        isLoading,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey,
        queryFn,
    });

    // Reset when search/filter/selectedUserId changes
    React.useEffect(() => {
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;
        const filterChanged = prevFilterStatusRef.current !== filterStatus;
        const selectedUserIdChanged =
            prevSelectedUserIdRef.current !== selectedUserId;

        if (searchChanged || filterChanged || selectedUserIdChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            prevFilterStatusRef.current = filterStatus;
            prevSelectedUserIdRef.current = selectedUserId;

            // Increment version to force new query
            setQueryKeyVersion((prev) => prev + 1);

            // Reset immediately when search or filter changes
            reset();
        }
    }, [debouncedSearch, filterStatus, selectedUserId, reset]);

    // Status filter component for the toolbar
    const StatusFilterComponent = () => {
        interface FilterOption {
            label: string;
            value: string;
        }

        const filterOptions: FilterOption[] = [
            {
                label: t("values.show_active_customers", { ns: "customers" }),
                value: "Active",
            },
            {
                label: t("values.show_inactive_customers", { ns: "customers" }),
                value: "Inactive",
            },
        ];

        const currentValue =
            filterOptions.find((option) => option.value === filterStatus) ||
            filterOptions[0];

        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: { xs: 1, sm: 2 },
                    alignItems: { xs: "stretch", sm: "center" },
                    flexWrap: "wrap",
                    width: "100%",
                }}
            >
                <ToolbarDropdownFilter<FilterOption>
                    value={currentValue}
                    onChange={(newValue: FilterOption | null) => {
                        setFilterStatus(
                            newValue?.value as "Active" | "Inactive"
                        );
                    }}
                    options={filterOptions}
                    getOptionLabel={(option: FilterOption) => option.label}
                    isOptionEqualToValue={(
                        option: FilterOption,
                        value: FilterOption
                    ) => option.value === value.value}
                    placeholder={t("values.status_filter", { ns: "customers" })}
                    sx={{
                        minWidth: { xs: "100%", sm: theme.spacing(30) },
                        width: { xs: "100%", sm: theme.spacing(30) },
                    }}
                />
            </Box>
        );
    };

    // Export handler for customers without contact
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
                        const amount =
                            customer?.CustomerCollectionPeriod?.[0]
                                ?.total_outstanding_amount ?? 0;
                        const currency =
                            customer?.CustomerCollectionPeriod?.[0]?.currency ??
                            "";

                        return {
                            id: customer.id,
                            name:
                                customer.type === "Person"
                                    ? `${getNestedValue(customer, "Person.first_name")} ${getNestedValue(customer, "Person.last_name")}`
                                    : getNestedValue(customer, "Company.name"),
                            collection_status: customer.collection_status,
                            type: customer.type,
                            customer_number: customer.customer_number,
                            current_category:
                                customer?.CustomerCollectionPeriod?.[0]
                                    ?.current_category ?? "",
                            no_of_overdue_invoices:
                                customer?.CustomerCollectionPeriod?.[0]
                                    ?.no_of_overdue_invoices ?? 0,
                            total_outstanding_amount: formatCurrencyWithCode(
                                amount,
                                currency
                            ),
                            raw: customer,
                        };
                    }
                );

                return transformedCustomers;
            } catch (_error) {
                console.error("Export failed:", _error);
                throw _error;
            }
        },
        [customers]
    );

    const rows = customers.map((customer: any, index: number) => {
        const amount =
            customer?.CustomerCollectionPeriod?.[0]?.total_outstanding_amount ??
            0;
        const currency =
            customer?.CustomerCollectionPeriod?.[0]?.currency ?? "";

        return {
            id:
                customer.id && typeof customer.id === "number"
                    ? customer.id
                    : `customer-${index}`,
            name: (() => {
                if (customer.type === "Person") {
                    const firstName =
                        getNestedValue(customer, "Person.first_name") || "";
                    const lastName =
                        getNestedValue(customer, "Person.last_name") || "";
                    const fullName = `${firstName} ${lastName}`.trim();
                    return fullName || `Person ${customer.id || index}`;
                } else {
                    const companyName =
                        getNestedValue(customer, "Company.name") || "";
                    return companyName || `Company ${customer.id || index}`;
                }
            })(),
            collection_status: customer.collection_status,
            type: customer.type,
            customer_number: customer.customer_number,
            current_category:
                customer?.CustomerCollectionPeriod?.[0]?.current_category ?? "",
            no_of_overdue_invoices:
                customer?.CustomerCollectionPeriod?.[0]
                    ?.no_of_overdue_invoices ?? 0,
            total_outstanding_amount: amount,
            total_outstanding_amount_formatted:
                amount === 0
                    ? `0.00 ${currency}`
                    : `${formatAmountWithoutSymbol(amount)} ${currency}`,
            raw: customer,
        };
    });

    const columns: GridColDef[] = [
        {
            field: "name",
            headerName: t("fields.name", { ns: "customers" }),
            flex: 1,
            renderCell: (params) => {
                const customerId = params.row.raw?.id;
                if (!customerId) {
                    return (
                        <Typography
                            component="span"
                            sx={{
                                color: "text.primary",
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%",
                            }}
                        >
                            {params.row.name}
                        </Typography>
                    );
                }
                return (
                    <Box
                        component={Link}
                        href={AppUrls.Customer_DETAILS(customerId)}
                        sx={{
                            color: "primary.main",
                            textDecoration: "underline",
                            textUnderlineOffset: "0.125em",
                            fontWeight: 500,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            width: "100%",
                            "&:hover": {
                                textDecoration: "underline",
                                color: "primary.dark",
                            },
                        }}
                    >
                        {params.row.name}
                    </Box>
                );
            },
        },
        {
            field: "customer_number",
            headerName: t("fields.customer_number", { ns: "customers" }),
            flex: 1,
            sortable: true,
            renderCell: (params: any) => (
                <Typography
                    component="span"
                    sx={{
                        color: "text.primary",
                    }}
                >
                    {params.row.customer_number}
                </Typography>
            ),
        },
        ...(clientType === "All"
            ? [
                  {
                      field: "type",
                      headerName: t("fields.type", { ns: "customers" }),
                      flex: 1,
                      renderCell: (params: any) => {
                          const typeKey =
                              params.row.type === "Person"
                                  ? "values.type_person"
                                  : params.row.type === "Company"
                                    ? "values.type_company"
                                    : null;
                          const translatedType = typeKey
                              ? t(typeKey, { ns: "customers" })
                              : params.row.type;
                          return (
                              <Typography
                                  component="span"
                                  sx={{
                                      color: "text.primary",
                                  }}
                              >
                                  {translatedType}
                              </Typography>
                          );
                      },
                  },
              ]
            : []),
        {
            field: "current_category",
            headerName: t("fields.category", { ns: "customers" }),
            flex: 1,
            renderCell: (params: any) => {
                const category = params.row.current_category;
                let categoryKey: string | null = null;

                if (!category) {
                    categoryKey = null;
                } else {
                    // Normalize category value (handle different cases and formats)
                    const normalizedCategory = category
                        .toString()
                        .toLowerCase()
                        .replace(/_/g, " ")
                        .trim();

                    if (normalizedCategory === "agent") {
                        categoryKey = "values.category_agent";
                    } else if (normalizedCategory === "automated") {
                        categoryKey = "values.category_automated";
                    } else if (normalizedCategory === "legal") {
                        categoryKey = "values.category_legal";
                    } else if (normalizedCategory === "dispute") {
                        categoryKey = "values.category_dispute";
                    } else if (
                        normalizedCategory === "promise to pay" ||
                        normalizedCategory === "promise_to_pay"
                    ) {
                        categoryKey = "values.category_promise_to_pay";
                    }
                }

                const translatedCategory = categoryKey
                    ? t(categoryKey, { ns: "customers" })
                    : category;
                return (
                    <Typography
                        component="span"
                        sx={{
                            color: "text.primary",
                        }}
                    >
                        {translatedCategory}
                    </Typography>
                );
            },
        },
        {
            field: "no_of_overdue_invoices",
            headerName: t("fields.no_of_overdue_invoices", { ns: "customers" }),
            flex: 1,
            renderCell: (params: any) => (
                <Typography
                    component="span"
                    sx={{
                        color: "text.primary",
                    }}
                >
                    {params.row.no_of_overdue_invoices}
                </Typography>
            ),
        },
        {
            field: "total_outstanding_amount",
            headerName: t("fields.total_outstanding_amount", {
                ns: "customers",
            }),
            flex: 1,
            renderCell: (params: any) => (
                <Typography
                    component="span"
                    sx={{
                        color:
                            params.row.total_outstanding_amount > 10000
                                ? "error.main"
                                : "text.primary",
                        fontWeight:
                            params.row.total_outstanding_amount > 10000
                                ? 600
                                : 400,
                    }}
                >
                    {params.row.total_outstanding_amount_formatted}
                </Typography>
            ),
        },
        {
            field: "actions",
            headerName: t("actions.actions", { ns: "common" }),
            sortable: false,
            filterable: false,
            width: 80,
            renderCell: (params: any) => (
                <Tooltip
                    title={t("actions.add_contact", { ns: "customers" })}
                    arrow
                    enterDelay={300}
                    leaveDelay={100}
                    placement="bottom"
                    PopperProps={{
                        sx: {
                            "& .MuiTooltip-tooltip": {
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
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
                        size="small"
                        onClick={() => {
                            const customerId = params.row.raw?.id;
                            const companyId = params.row.raw?.Company?.id;
                            if (customerId && companyId) {
                                setSelectedCustomerId(customerId);
                                setSelectedCompanyId(companyId);
                                setIsModalOpen(true);
                            }
                        }}
                        color="primary"
                    >
                        <PersonAdd fontSize="small" />
                    </IconButton>
                </Tooltip>
            ),
        },
    ];

    // Error state
    if (error) {
        return (
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
        );
    }

    return (
        <Box
            sx={(theme) => ({
                width: "100%",
                bgcolor: "background.paper",
                borderRadius: getMetricStatCardBorderRadius(theme),
                minHeight: 400,
            })}
        >
            {isLoading && customers.length === 0 ? (
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
                        customButtons={<StatusFilterComponent />}
                        searchValue={search}
                        onSearchChange={setSearch}
                        searchPlaceholder={t("fields.search_placeholder", {
                            ns: "common",
                        })}
                        searchDebounceMs={500}
                        searchDisabled={false}
                        searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                        noRowsMessage={t("messages.no_customers_found", {
                            ns: "customers",
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
                            pageName: "customers_without_contact",
                            customPrefix: "customers_without_contact_export",
                        }}
                        // Currency columns configuration for export splitting
                        currencyColumns={
                            {
                                total_outstanding_amount: {
                                    amountField:
                                        "total_outstanding_amount_value",
                                    currencyField:
                                        "total_outstanding_amount_currency",
                                },
                            } as CurrencyColumnsConfig
                        }
                    />
                </Box>
            )}
            {selectedCustomerId && selectedCompanyId && (
                <UpsertContactModal
                    isOpen={isModalOpen}
                    companyId={selectedCompanyId}
                    customerId={selectedCustomerId}
                    closeModal={() => {
                        setIsModalOpen(false);
                        setSelectedCustomerId(null);
                        setSelectedCompanyId(null);
                    }}
                />
            )}
        </Box>
    );
};

export default CustomersWithoutContactList;
