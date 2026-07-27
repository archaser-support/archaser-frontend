"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import EndlessScrollDataGrid, {
    createQueryFn,
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { ExportFormat } from "@/shared/utility/exportToExcel";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

type CurrencyRateApiRow = {
    id: number;
    rate_date: string;
    base_currency: string;
    other_currency: string;
    currency_ratio: number;
};

export function CurrencyRateSettingsList() {
    const { t, i18n } = useTranslation(["settings", "common"]);
    const theme = useTheme();
    const { data: session } = useSession();
    const userLocale = useMemo(() => getUserDateLocale(session), [session]);
    const userTimezone = useMemo(() => getUserTimezone(session), [session]);

    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "rate_date", sort: "desc" },
    ]);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);

    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort || "desc";

    const queryKey = useMemo(
        () => [
            "currency-rates-grid",
            {
                search: debouncedSearch,
                sortField,
                sortDirection,
                version: queryKeyVersion,
            },
        ],
        [debouncedSearch, sortField, sortDirection, queryKeyVersion]
    );

    const {
        data,
        totalRecords,
        isLoading,
        hasMore,
        loadMore,
        reset,
        error,
    } = useVirtualInfiniteScroll<CurrencyRateApiRow>({
        queryKey,
        queryFn: createQueryFn(
            "/api/settings/currency-rates",
            {
                query: debouncedSearch,
                sortField: sortField || "rate_date",
                sortDirection: sortDirection || "desc",
            },
            "rates"
        ),
    });

    const prevDebouncedSearchRef = useRef(debouncedSearch);
    useEffect(() => {
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;
        if (searchChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            setQueryKeyVersion((v) => v + 1);
        }
    }, [debouncedSearch]);

    const rows = useMemo(() => {
        return (data || []).map((row) => ({
            id: row.id,
            rate_date: row.rate_date,
            base_currency: row.base_currency,
            other_currency: row.other_currency,
            currency_ratio: row.currency_ratio,
        }));
    }, [data]);

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "rate_date",
                headerName: t("currency_rate.columns.rate_date", {
                    ns: "settings",
                    defaultValue: "Rate date",
                }),
                flex: 0.8,
                minWidth: 130,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {params.value
                            ? formatDateForDisplay(
                                  String(params.value),
                                  "date",
                                  userLocale,
                                  userTimezone
                              )
                            : "-"}
                    </Typography>
                ),
            },
            {
                field: "base_currency",
                headerName: t("currency_rate.columns.base_currency", {
                    ns: "settings",
                    defaultValue: "Base currency",
                }),
                flex: 0.7,
                minWidth: 130,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {params.value || "-"}
                    </Typography>
                ),
            },
            {
                field: "other_currency",
                headerName: t("currency_rate.columns.other_currency", {
                    ns: "settings",
                    defaultValue: "Other currency",
                }),
                flex: 0.7,
                minWidth: 130,
                renderCell: (params) => (
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                        {params.value || "-"}
                    </Typography>
                ),
            },
            {
                field: "currency_ratio",
                headerName: t("currency_rate.columns.currency_ratio", {
                    ns: "settings",
                    defaultValue: "Currency ratio",
                }),
                flex: 0.8,
                minWidth: 140,
                align: "left",
                headerAlign: "left",
                renderCell: (params) => (
                    <Typography
                        variant="body2"
                        sx={{ width: "100%", textAlign: "left", fontSize: "0.875rem" }}
                    >
                        {typeof params.value === "number"
                            ? Number(params.value).toFixed(6)
                            : "-"}
                    </Typography>
                ),
            },
        ],
        [t, userLocale, userTimezone]
    );

    const handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            const params = new URLSearchParams({
                page: "1",
                limit: "10000",
                query: debouncedSearch,
                sortField: sortField || "rate_date",
                sortDirection: sortDirection || "desc",
            });
            const response = await apiFetch(`/api/settings/currency-rates?${params.toString()}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const json = await response.json();
            const rates = (json.rates || []) as CurrencyRateApiRow[];
            return rates.map((row) => ({
                id: row.id,
                rate_date: row.rate_date,
                base_currency: row.base_currency,
                other_currency: row.other_currency,
                currency_ratio:
                    typeof row.currency_ratio === "number"
                        ? row.currency_ratio.toFixed(6)
                        : "",
            }));
        },
        [debouncedSearch, sortField, sortDirection]
    );

    if (isLoading && rows.length === 0) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: theme.spacing(50),
                }}
            >
                <CircularProgress size={40} />
            </Box>
        );
    }

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
                <Typography color="error">
                    {t("currency_rate.grid_error", {
                        ns: "settings",
                        defaultValue: "Failed to load currency rates",
                    })}
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Box sx={{ position: "relative", isolation: "isolate" }}>
                <EndlessScrollDataGrid
                    key={`currency-rates-${debouncedSearch}-${queryKeyVersion}`}
                    rows={rows}
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
                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                    language={i18n.language}
                    fillViewport={true}
                    resizableColumns={true}
                    onExport={handleExport}
                    exportContextInfo={{
                        pageName: "currency_rates",
                        customPrefix: "currency_rates",
                    }}
                    noRowsMessage={t("currency_rate.no_rows", {
                        ns: "settings",
                        defaultValue: "No currency rates found",
                    })}
                    noRowsDescription={t("currency_rate.no_rows_hint", {
                        ns: "settings",
                        defaultValue: "Try adjusting your search criteria.",
                    })}
                />
            </Box>
        </Box>
    );
}

