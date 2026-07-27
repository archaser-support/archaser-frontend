"use client";

import { Handshake as HandshakeIcon } from "@mui/icons-material";
import { Button, Box, CircularProgress, Typography, Chip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import {
    GridSortModel,
    GridColDef,
    GridRenderCellParams,
} from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import EndlessScrollDataGrid, {
    BREAKPOINTS,
    useWindowWidth,
    useVirtualInfiniteScroll,
    createQueryFn,
    createApiQueryFn,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import PageHeader from "@/components/PageHeader";
import { fetchDisputeWithPromiseToPayStats } from "@/shared/services/promiseToPayService";
import {
    formatCurrencyWithCode,
    CurrencyColumnsConfig,
    ExportFormat,
} from "@/shared/utility/exportToExcel";
import { getNestedValue } from "@/shared/utility/helpers";
import { PromiseToPayCustomer } from "@/types/CustomerWithPromiseToPay";
import AppUrls from "@/utils/appUrls";
import {
    formatDateForDisplay,
    getUserTimezone,
    getUserDateLocale,
} from "@/utils/datetimeOperations";
import {
    formatAmountWithoutSymbol,
    formatCurrencyWithRTLSupport,
} from "@/utils/stringFormatters";

import PromiseToPayStats from "./components/PromiseToPayStats";

// Constants
const ROWS_PER_PAGE = 20;

// Types
interface PromiseToPayListProps {
    title?: string;
    description?: string;
}

export interface PromiseToPayRow {
    id: number;
    customer: string;
    customer_number: string;
    amount_overdue: number;
    days_past_due: number;
    promise_date: string | Date | null;
    urgency_color: string;
    customer_id: number;
    customer_uuid: string;
}

const PromiseToPayList: React.FC<PromiseToPayListProps> = ({
    title,
    description,
}) => {
    const { t, i18n } = useTranslation(["promise_to_pay", "common"]);
    const theme = useTheme();
    const router = useRouter();
    const { data: session } = useSession();
    const windowWidth = useWindowWidth();
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "customer", sort: "asc" },
    ]);

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Create query key
    const queryKey = useMemo(
        () => [
            "promiseToPay-virtual",
            {
                query: debouncedSearch,
                sortField: sortModel[0]?.field,
                sortDirection: sortModel[0]?.sort,
            },
        ],
        [debouncedSearch, sortModel[0]?.field, sortModel[0]?.sort]
    );

    // Use virtual infinite scroll hook
    const {
        data: promiseToPayList,
        totalRecords,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey,
        queryFn: createQueryFn(
            "/api/system/promise-to-pay",
            {
                search: debouncedSearch,
                sortField: sortModel[0]?.field || "customer",
                sortDirection: sortModel[0]?.sort || "asc",
            },
            "promiseToPayList"
        ),
    });

    // Reset when search changes (but not for sort changes)
    React.useEffect(() => {
        // Only reset if the values actually changed
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;

        if (searchChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            reset();
        }
    }, [debouncedSearch, reset]);

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

    const getUrgencyColor = useCallback((days: number): string => {
        const colors = {
            critical: "primary.dark", // 90+ days
            high: "primary.main", // 60+ days
            medium: "secondary.main", // 30+ days
            low: "secondary.light", // <30 days
        };

        if (days >= 90) return colors.critical;
        if (days >= 60) return colors.high;
        if (days >= 30) return colors.medium;
        return colors.low;
    }, []);

    const transformDataToRows = useCallback(
        (promiseToPayList: PromiseToPayCustomer[]) => {
            return promiseToPayList.map((item) => {
                const name = item.Customer.Person
                    ? `${item.Customer.Person.first_name} ${item.Customer.Person.last_name}`
                    : item.Customer.Company?.name || t("fields.unknown");

                const amount = item.total_outstanding_amount || 0;
                const currency = item.currency || "";
                const oldestDate = item.Customer?.oldest_invoice_overdue_date;
                const daysPastDue = oldestDate
                    ? Math.floor(
                        (new Date().getTime() -
                            new Date(oldestDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                    : 0;

                return {
                    id: item.id,
                    customer: name,
                    customer_number:
                        item.Customer?.customer_number || t("fields.unknown"),
                    amount_overdue: amount,
                    amount_overdue_formatted: formatCurrencyWithRTLSupport(
                        amount,
                        currency,
                        session?.user?.locale || "en-US",
                        i18n.language
                    ),
                    days_past_due: daysPastDue,
                    promise_date: item.promise_to_pay_date
                        ? new Date(item.promise_to_pay_date).toISOString()
                        : null,
                    urgency_color: getUrgencyColor(daysPastDue),
                    customer_id: item.Customer.id,
                    customer_uuid: item.Customer.customer_uuid,
                };
            });
        },
        [t, getUrgencyColor]
    );

    // Transform data to rows
    const rows = useMemo(() => {
        return transformDataToRows(promiseToPayList as PromiseToPayCustomer[]);
    }, [promiseToPayList, transformDataToRows]);

    // Export handler for promise to pay
    const handleExport = useCallback(
        async (
            selectedColumns: string[],
            fileName: string,
            format: ExportFormat
        ) => {
            try {
                // Use the existing rows data instead of making a new API call
                const rawPromiseToPayList = rows || [];

                // Rows are already transformed, so we can return them directly
                const transformedPromiseToPay = rawPromiseToPayList.map(
                    (item: any) => {
                        const amount = item.amount_overdue || 0;
                        const currency = item.currency || "";

                        // Format promise date for export
                        const promiseDate = item.promise_date
                            ? formatDateForDisplay(
                                item.promise_date,
                                "date",
                                getUserDateLocale(session),
                                getUserTimezone(session)
                            )
                            : "";

                        return {
                            id: item.id,
                            customer: item.customer,
                            customer_number: item.customer_number,
                            amount_overdue: formatCurrencyWithCode(
                                amount,
                                currency
                            ),
                            days_past_due: item.days_past_due,
                            promise_date: promiseDate,
                            urgency_color: item.urgency_color,
                            customer_id: item.customer_id,
                            customer_uuid: item.customer_uuid,
                            raw: item.raw,
                        };
                    }
                );

                return transformedPromiseToPay;
            } catch (error) {
                console.error("Export failed:", error);
                throw error;
            }
        },
        [rows, t, session, getUrgencyColor]
    );

    // Stats query for the stat cards (not affected by search)
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ["promiseToPayStats"],
        queryFn: fetchDisputeWithPromiseToPayStats,
        refetchOnWindowFocus: false,
    });

    const columnVisibilityModel = useMemo(
        () => ({
            customer_number: windowWidth >= BREAKPOINTS.MOBILE,
            amount_overdue: windowWidth >= BREAKPOINTS.TABLET,
            days_past_due: windowWidth >= BREAKPOINTS.MOBILE,
            promise_date: windowWidth >= BREAKPOINTS.TABLET,
        }),
        [windowWidth]
    );

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "customer",
                headerName: t("fields.customer", { ns: "promise_to_pay" }),
                flex: 1,
                minWidth: 200,
                renderCell: (params: GridRenderCellParams) => {
                    const isRTL = i18n.language === "he";
                    const customerUrl = `${AppUrls.Customer_DETAILS(params.row.customer_id)}?tab=activities`;

                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                                direction: isRTL ? "rtl" : "ltr",
                            }}
                        >
                            <Typography
                                variant="body2"
                                data-cell-link="true"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    router.push(customerUrl);
                                }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                }}
                                sx={{
                                    fontWeight: theme.typography.fontWeightMedium,
                                    color: theme.palette.primary.main,
                                    cursor: "pointer",
                                    pointerEvents: "auto",
                                    textAlign: isRTL ? "right" : "left",
                                    direction: isRTL ? "rtl" : "ltr",
                                    textDecoration: "underline",
                                    textUnderlineOffset: "0.125em",
                                    "&:hover": {
                                        color: theme.palette.primary.dark,
                                        textDecoration: "underline",
                                    },
                                }}
                            >
                                {params.value}
                            </Typography>
                        </Box>
                    );
                },
            },
            {
                field: "customer_number",
                headerName: t("fields.customer_number", {
                    ns: "promise_to_pay",
                }),
                flex: 0.8,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">{params.value}</Typography>
                ),
            },
            {
                field: "amount_overdue",
                headerName: t("fields.amount_overdue", {
                    ns: "promise_to_pay",
                }),
                flex: 0.8,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2" fontWeight={600}>
                        {params.row.amount_overdue_formatted}
                    </Typography>
                ),
            },
            {
                field: "days_past_due",
                headerName: t("fields.days_past_due", { ns: "promise_to_pay" }),
                flex: 0.6,
                minWidth: 120,
                renderCell: (params) => (
                    <Chip
                        label={`${params.value} ${t("fields.days")}`}
                        size="small"
                        sx={{
                            backgroundColor: params.row.urgency_color,
                            color: "white",
                            fontWeight: 600,
                            fontSize: theme.typography.caption.fontSize,
                        }}
                    />
                ),
            },
            {
                field: "promise_date",
                headerName: t("fields.promise_date", { ns: "promise_to_pay" }),
                flex: 0.8,
                minWidth: 150,
                renderCell: (params) => {
                    const promiseDate = params.value;

                    if (!promiseDate) {
                        return <Typography variant="body2">--</Typography>;
                    }

                    // Get proper locale from session using the same logic as activities
                    const userLocale = getUserDateLocale(session);

                    // formatDateForDisplay can handle both Date objects and strings
                    const formattedDate = formatDateForDisplay(
                        promiseDate,
                        "date",
                        userLocale,
                        getUserTimezone(session)
                    );

                    return (
                        <Typography variant="body2">{formattedDate}</Typography>
                    );
                },
            },
        ],
        [t, theme, i18n.language, session, router]
    );

    const handleClearFilters = useCallback(() => {
        setSearch("");
        setSortModel([{ field: "customer", sort: "asc" }]);
    }, []);

    if (error) {
        return (
            <Box sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="h6" color="error" sx={{ mb: 2 }}>
                    {t("messages.error_fetching_data")}
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => window.location.reload()}
                    sx={{ mr: 1 }}
                >
                    {t("actions.retry", { ns: "common" })}
                </Button>
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleClearFilters}
                >
                    {t("common.fields.clear_filters")}
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ bgcolor: "background.default", borderRadius: 2 }}>
            {/* Header Section */}
            <PageHeader
                title={title || t("fields.title", { ns: "promise_to_pay" })}
                description={description || t("messages.description")}
            />

            {/* Stats Cards */}
            <PromiseToPayStats
                statsData={statsData}
                statsLoading={statsLoading}
                promiseToPayList={rows}
            />

            {/* Grid - mount only after stats have loaded so viewport height is correct */}
            {statsLoading ? (
                <Box
                    sx={{
                        minHeight: 400,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "background.paper",
                        borderRadius: theme.shape.borderRadius,
                    }}
                >
                    <CircularProgress />
                </Box>
            ) : (
                <Box
                    ref={tableContainerRef}
                    sx={{
                        width: "100%",
                        bgcolor: "background.paper",
                        borderRadius: theme.shape.borderRadius,
                    }}
                >
                    <EndlessScrollDataGrid
                        key={`${debouncedSearch}`}
                        rows={rows}
                        columns={columns}
                        totalRecords={totalRecords}
                        isLoading={isLoading}
                        onLoadMore={loadMore}
                        hasMore={hasMore}
                        sortModel={sortModel}
                        onSortModelChange={setSortModel}
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
                        columnVisibilityModel={columnVisibilityModel}
                        noRowsMessage={t("messages.no_data_available", {
                            ns: "promise_to_pay",
                        })}
                        noRowsDescription={t(
                            "messages.no_data_available_description",
                            { ns: "promise_to_pay" }
                        )}
                        onExport={handleExport}
                        exportContextInfo={{
                            pageName: "promise_to_pay",
                            customPrefix: "promise_to_pay_export",
                        }}
                        // Currency columns configuration for export splitting
                        currencyColumns={
                            {
                                amount_overdue: {
                                    amountField: "amount_overdue_value",
                                    currencyField: "amount_overdue_currency",
                                },
                            } as CurrencyColumnsConfig
                        }
                    />
                </Box>
            )}
        </Box>
    );
};

export default PromiseToPayList;
