"use client";
import { Link as LinkIcon } from "@mui/icons-material";
import {
    Box,
    Button,
    CircularProgress,
    IconButton,
    Tooltip,
    Typography,
} from "@mui/material";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import api from "@/app/api";
import { AssignCreditToInvoiceDialog } from "./AssignCreditToInvoiceDialog";
import EndlessScrollDataGrid, {
    createApiQueryFn,
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    assignCreditToInvoice,
    fetchAvailableInvoices
} from "@/shared/services/InvoiceStatusService";
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
import {
    formatCurrencyWithRTLSupport,
} from "@/utils/stringFormatters";

const OrphanCreditInvoicesList: React.FC = () => {
    const { t, i18n } = useTranslation([
        "control_center",
        "invoices",
        "customers",
        "common",
    ]);
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { data: session } = useSession();
    const searchParams = useSearchParams();

    const selectedUserId = searchParams?.get("selectedUserId");

    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "invoice_number", sort: "asc" },
    ]);

    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);

    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedCreditInvoice, setSelectedCreditInvoice] =
        useState<any>(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | "">("");
    const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
    const [isAssigningCredit, setIsAssigningCredit] = useState(false);

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const prevSelectedUserIdRef = useRef(selectedUserId);

    // Extract sort field and direction
    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort;

    // Create query key
    const queryKey = useMemo(
        () => [
            "orphanCreditInvoices-virtual",
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
                        `/system/control-center?operation=orphan-credit-invoices&${queryParams.toString()}`
                    );
                    return response.data;
                },
                {
                    search: debouncedSearch,
                    sortField: sortField || "",
                    sortDirection: sortDirection || "asc",
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
    } = useVirtualInfiniteScroll({
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

    const refreshList = async () => {
        // Invalidate all orphan credit invoices queries to ensure fresh data
        await queryClient.invalidateQueries({
            queryKey: ["orphanCreditInvoices"],
            exact: false,
        });

        // Also invalidate control center stats since the count will change
        await queryClient.invalidateQueries({
            queryKey: ["controlCenterStats"],
            exact: false,
        });
    };

    const openAssignModal = async (creditInvoice: any) => {
        setSelectedCreditInvoice(creditInvoice);
        setSelectedInvoiceId("");

        // Validate customer_id before making the API call
        if (!creditInvoice.customer_id) {
            showToast(
                t("messages.error_invalid_account_id", {
                    ns: "control_center",
                }),
                "error"
            );
            return;
        }

        // Fetch available invoices for assignment
        try {
            const invoices = await fetchAvailableInvoices(
                creditInvoice.customer_id
            );

            // Filter invoices to show only those with same or higher amount than the credit
            const creditAmount = Math.abs(creditInvoice.amount);
            const filteredInvoices = invoices.filter(
                (invoice: any) => invoice.amount >= creditAmount
            );

            setAvailableInvoices(filteredInvoices);
            setAssignModalOpen(true);
        } catch (_error) {
            showToast(
                t("messages.error_fetching_available_invoices", {
                    ns: "control_center",
                }),
                "error"
            );
        }
    };

    const handleCloseAssignModal = useCallback(() => {
        setSelectedInvoiceId("");
        setSelectedCreditInvoice(null);
        setAvailableInvoices([]);
        setAssignModalOpen(false);
    }, []);

    const handleAssignCredit = async () => {
        if (!selectedInvoiceId || !selectedCreditInvoice) {
            showToast(
                t("messages.error_please_select_invoice", {
                    ns: "control_center",
                }),
                "error"
            );
            return;
        }

        setIsAssigningCredit(true);
        try {
            const result = await assignCreditToInvoice(
                selectedCreditInvoice.id,
                selectedInvoiceId
            );
            showToast(
                t("messages.success_credit_assigned", { ns: "control_center" }),
                "success"
            );

            // Clear modal state before closing
            setSelectedCreditInvoice(null);
            setSelectedInvoiceId("");
            setAvailableInvoices([]);
            setAssignModalOpen(false);
            await refreshList();

            // Force a refetch to ensure we get the latest data
            await queryClient.refetchQueries({
                queryKey: ["orphanCreditInvoices"],
                exact: false,
            });

            // Use batch cache invalidator for efficient cache management
            const { BatchCacheInvalidator } = await import(
                "@/utils/cacheUtils"
            );
            const batchInvalidator = new BatchCacheInvalidator();

            // Mark control center stats for invalidation since orphan credit invoice was assigned
            batchInvalidator.markControlCenterForInvalidation();

            // Invalidate UnpaidInvoiceList queries for affected customers
            if (
                result?.affectedCustomerIds &&
                result.affectedCustomerIds.length > 0
            ) {
                batchInvalidator.addAffectedCustomers(
                    result.affectedCustomerIds
                );
            }

            // Execute all cache invalidations at once
            if (batchInvalidator.hasPendingInvalidations()) {
                await batchInvalidator.executeInvalidations();
            }
        } catch (error: any) {
            const errorMessage =
                error?.response?.data?.details ||
                error?.response?.data?.error ||
                error?.message ||
                t("messages.error_assigning_credit", { ns: "control_center" });
            showToast(errorMessage, "error");
        } finally {
            setIsAssigningCredit(false);
        }
    };

    // Export handler for orphan credit invoices
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
                    const currency =
                        invoice.customer_currency ||
                        invoice.Account?.Country?.currency ||
                        "";
                    const amount = invoice.amount || 0;
                    const netAmount = invoice.net_amount || 0;

                    return {
                        id: invoice.id,
                        invoice_number: invoice.invoice_number,
                        customer_number:
                            invoice.Customer?.customer_number || "",
                        amount: formatCurrencyWithCode(amount, currency),
                        net_amount: formatCurrencyWithCode(netAmount, currency),
                        due_date: invoice.due_date
                            ? formatDateForDisplay(
                                invoice.due_date.toString(),
                                "date",
                                getUserDateLocale(session),
                                getUserTimezone(session)
                            )
                            : "",
                        raw: invoice,
                    };
                });

                return transformedInvoices;
            } catch (_error) {
                console.error("Export failed:", _error);
                throw _error;
            }
        },
        [invoices, session]
    );

    const columns: GridColDef[] = [
        {
            field: "invoice_number",
            headerName: t("fields.invoice_number", { ns: "invoices" }),
            flex: 1,
            renderCell: (params) => (
                <Typography component="span" variant="body2" fontWeight={500}>
                    {params.row.invoice_number}
                </Typography>
            ),
        },
        {
            field: "customer_number",
            headerName: t("fields.customer_number", { ns: "customers" }),
            flex: 1,
            renderCell: (params) => (
                <Typography component="span" variant="body2">
                    {params.row.Customer?.customer_number || ""}
                </Typography>
            ),
        },
        {
            field: "amount",
            headerName: t("fields.amount", { ns: "invoices" }),
            flex: 1,
            renderCell: (params) => {
                const currency =
                    params.row.customer_currency ||
                    params.row.Account?.Country?.currency ||
                    "";
                const amount = params.row.amount || 0;
                const formattedAmount = formatCurrencyWithRTLSupport(
                    amount,
                    currency,
                    "en-US",
                    i18n.language
                );
                const isRTL = i18n.language === "he";
                return (
                    <Typography
                        component="span"
                        variant="body2"
                        color={amount < 0 ? "error" : "textPrimary"}
                        fontWeight={amount < 0 ? 600 : 400}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            direction: isRTL ? "rtl" : "ltr",
                            textAlign: isRTL ? "right" : "left",
                            unicodeBidi: isRTL ? "plaintext" : "normal",
                        }}
                    >
                        {formattedAmount}
                    </Typography>
                );
            },
        },
        {
            field: "net_amount",
            headerName: t("fields.net_amount", { ns: "invoices" }),
            flex: 1,
            renderCell: (params) => {
                const currency =
                    params.row.customer_currency ||
                    params.row.Account?.Country?.currency ||
                    "";
                const netAmount = params.row.net_amount || 0;
                const formattedAmount = formatCurrencyWithRTLSupport(
                    netAmount,
                    currency,
                    "en-US",
                    i18n.language
                );
                const isRTL = i18n.language === "he";
                return (
                    <Typography
                        component="span"
                        variant="body2"
                        color={netAmount < 0 ? "error" : "textPrimary"}
                        fontWeight={netAmount < 0 ? 600 : 400}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            direction: isRTL ? "rtl" : "ltr",
                            textAlign: isRTL ? "right" : "left",
                            unicodeBidi: isRTL ? "plaintext" : "normal",
                        }}
                    >
                        {formattedAmount}
                    </Typography>
                );
            },
        },
        {
            field: "due_date",
            headerName: t("fields.due_date", { ns: "invoices" }),
            flex: 1,
            renderCell: (params) => {
                return (
                    <Typography component="span" variant="body2">
                        {params.row.due_date
                            ? formatDateForDisplay(
                                params.row.due_date.toString(),
                                "date",
                                getUserDateLocale(session),
                                getUserTimezone(session)
                            )
                            : ""}
                    </Typography>
                );
            },
        },
        {
            field: "actions",
            headerName: t("actions.actions", { ns: "common" }),
            flex: 1,
            sortable: false,
            renderCell: (params) => (
                <Tooltip
                    title={t("tooltips.assign_credit", {
                        ns: "control_center",
                    })}
                >
                    <IconButton
                        size="small"
                        onClick={() => openAssignModal(params.row)}
                        color="primary"
                    >
                        <LinkIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ),
        },
    ];

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
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
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    height={400}
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
                        rows={invoices}
                        columns={columns}
                        totalRecords={totalRecords}
                        isLoading={isLoading}
                        onLoadMore={loadMore}
                        hasMore={hasMore}
                        sortModel={sortModel}
                        onSortModelChange={setSortModel}
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
                            {
                                ns: "common",
                            }
                        )}
                        language={i18n.language}
                        fillViewport={true}
                        resizableColumns={true}
                        onExport={handleExport}
                        exportContextInfo={{
                            pageName: "orphan_credit_invoices",
                            customPrefix: "orphan_credit_invoices_export",
                        }}
                        // Currency columns configuration for export splitting
                        currencyColumns={
                            {
                                amount: {
                                    amountField: "amount_value",
                                    currencyField: "amount_currency",
                                },
                                net_amount: {
                                    amountField: "net_amount_value",
                                    currencyField: "net_amount_currency",
                                },
                            } as CurrencyColumnsConfig
                        }
                    />
                </Box>
            )}

            <AssignCreditToInvoiceDialog
                open={assignModalOpen}
                onClose={handleCloseAssignModal}
                availableInvoices={availableInvoices}
                selectedInvoiceId={selectedInvoiceId}
                onSelectedInvoiceIdChange={setSelectedInvoiceId}
                selectedCreditInvoice={selectedCreditInvoice}
                isAssigning={isAssigningCredit}
                onAssign={handleAssignCredit}
            />
        </Box>
    );
};

export default OrphanCreditInvoicesList;
