"use client";
import { apiFetch } from "@/utils/apiFetch";
import {
    AccountBalance as AccountBalanceIcon,
    Category,
} from "@mui/icons-material";
import {
    alpha,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Popover,
    Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import PageHeader from "@/components/PageHeader";
import { BulkActionButton } from "@/shared/components/BulkActionButton";
import EndlessScrollDataGrid, {
    BREAKPOINTS,
    createQueryFn,
    useVirtualInfiniteScroll,
    useWindowWidth
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { fetchCountriesFromApi } from "@/shared/redux/action";
import { useAppDispatch, useAppSelector } from "@/shared/redux/hooks";
import { fetchLegalStats } from "@/shared/services/legalService";
import {
    CurrencyColumnsConfig,
    ExportFormat,
    formatCurrencyWithCode,
} from "@/shared/utility/exportToExcel";
import AppUrls from "@/utils/appUrls";
import {
    formatDateForDisplay,
    getCountryTimezone,
    getCurrentTimeForCountry,
} from "@/utils/datetimeOperations";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

// Dynamically import modal to prevent CSS chunking issues
const MassUpdateCategoryModal = dynamic(
    () => import("@/app/[locale]/app/customers/components/MassUpdateCategoryModal").then((mod) => mod.default),
    {
        ssr: false,
        loading: () => null,
    }
);

import LegalStats from "./components/LegalStats";

// Constants
const INITIAL_ROWS_PER_PAGE = 20;

const DEFAULT_SORT_MODEL: GridSortModel = [
    { field: "last_call", sort: "desc" },
];

const formatLastCall = (
    lastCall: Date | string | null,
    session: any
): string | null => {
    if (!lastCall) return null;
    return formatDateForDisplay(
        new Date(lastCall),
        "datetime",
        session?.user?.locale,
        session?.user?.timezone
    );
};

const getUrgencyColor = (days: number, theme: any): string => {
    const colors = {
        high: theme.palette.chartPalette.dark, // 90+ days
        medium: theme.palette.chartPalette.main, // 60+ days
        low: theme.palette.chartPalette.light, // 30+ days
        minimal: alpha(theme.palette.chartPalette.main, 0.5), // <30 days
    };

    if (days >= 90) return colors.high;
    if (days >= 60) return colors.medium;
    if (days >= 30) return colors.low;
    return colors.minimal;
};

interface LegalListProps {
    title?: string;
    description?: string;
}

const LegalList: React.FC<LegalListProps> = ({
    title = "Legal Cases",
    description = "Manage legal collection cases and their activities",
}) => {
    const { t, i18n } = useTranslation(["legal", "common", "activities"]);
    const { data: session } = useSession();
    const router = useRouter();
    const dispatch = useAppDispatch();
    const countries = useAppSelector((state) => state.countries || []);
    const windowWidth = useWindowWidth();
    const theme = useTheme();

    React.useEffect(() => {
        if (!countries.length) {
            dispatch(fetchCountriesFromApi());
        }
    }, [countries, dispatch]);

    const formatLastCallResult = useCallback(
        (lastCallResult: string | null) => {
            if (!lastCallResult) return null;

            // Handle double bracket translation keys (same pattern as Activity title/content)
            if (
                lastCallResult.startsWith("{{") &&
                lastCallResult.endsWith("}}")
            ) {
                // Extract translation key (e.g., "{{activities.values.outcomes_open_dispute}}" -> "activities.values.outcomes_open_dispute")
                const translationKey = lastCallResult.slice(2, -2);
                // If key starts with "activities.", use the part after it for namespace lookup
                let keyToUse = translationKey;
                if (translationKey.startsWith("activities.")) {
                    keyToUse = translationKey.replace("activities.", "");
                }
                const translation = t(keyToUse, { ns: "activities" });

                // Return translation if found, otherwise return the key as fallback
                if (
                    translation &&
                    !translation.startsWith("values.outcomes_") &&
                    translation !== keyToUse
                ) {
                    return translation;
                }
                // Fallback: extract outcome value and format nicely
                const outcomeMatch = translationKey.match(
                    /activities\.values\.outcomes_(.+)/
                );
                if (outcomeMatch) {
                    const outcomeValue = outcomeMatch[1];
                    return outcomeValue
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase());
                }
                return translationKey;
            }

            // Legacy handling: normalize the outcome value to snake_case
            const normalizedOutcome = lastCallResult
                .toLowerCase()
                .trim()
                .replace(/[\s-]+/g, "_");

            // Direct translation lookup with activities namespace
            const translationKey = `values.outcomes_${normalizedOutcome}`;

            // Try both with and without explicit namespace since activities is in useTranslation array
            let translation = t(translationKey, { ns: "activities" });

            // If translation returned the key, try without namespace (activities is already in useTranslation)
            if (
                translation === translationKey ||
                translation.startsWith("values.outcomes_")
            ) {
                translation = t(translationKey);
            }

            // Check if translation was found (i18next returns the key if translation not found)
            // Also check if translation doesn't start with "values.outcomes_" which would indicate missing translation
            if (translation && !translation.startsWith("values.outcomes_")) {
                return translation;
            }

            // Fallback: format the outcome key nicely (e.g., "bad_number" -> "Bad Number")
            return normalizedOutcome
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase());
        },
        [t, i18n.language]
    );

    const [searchQuery, setSearchQuery] = useState<string>("");
    const [debouncedSearch] = useDebounce(searchQuery, 500);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);
    const [sortModel, setSortModel] =
        useState<GridSortModel>(DEFAULT_SORT_MODEL);
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [isMassUpdateModalOpen, setIsMassUpdateModalOpen] = useState(false);
    // Actions menu state - using position instead of anchor element to avoid DOM issues
    const [menuPosition, setMenuPosition] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const queryClient = useQueryClient();
    const { showToast: _showToast } = useToast();

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Create query key
    const queryKey = useMemo(
        () => [
            "legalCases-virtual",
            {
                query: debouncedSearch,
                sortField: sortModel[0]?.field || "last_call",
                sortDirection: sortModel[0]?.sort || "desc",
                version: queryKeyVersion,
            },
        ],
        [
            debouncedSearch,
            sortModel[0]?.field,
            sortModel[0]?.sort,
            queryKeyVersion,
        ]
    );

    // Use virtual infinite scroll hook
    const {
        data: legalCases,
        totalRecords,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll<any>({
        queryKey,
        queryFn: createQueryFn(
            "/api/operations/legal-cases",
            {
                search: debouncedSearch,
                sortField: sortModel[0]?.field || "last_call",
                sortDirection: sortModel[0]?.sort || "desc",
            },
            "legalCases"
        ),
    });

    // Stats query for the stat cards (not affected by search)
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ["legalStats"],
        queryFn: fetchLegalStats,
        refetchOnWindowFocus: false,
    });

    // Reset when search changes (but not for sort changes)
    React.useEffect(() => {
        // Only reset if the values actually changed
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;

        if (searchChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;

            // Increment version to force new query
            setQueryKeyVersion((prev) => prev + 1);

            // Reset immediately when search changes
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

    const countryTimes = useMemo(() => {
        const times: Record<string, string> = {};
        const uniqueCountries = Array.from(
            new Set(
                legalCases.map((row: any) => row.customer_country || "Unknown")
            )
        );

        uniqueCountries.forEach((country) => {
            if (country === "Unknown") {
                times[country] = t("fields.unknown");
            } else {
                const time = getCurrentTimeForCountry(
                    country,
                    undefined,
                    "en-US",
                    true
                );
                const timezone = getCountryTimezone(country);
                times[country] =
                    timezone !== "UTC" ? `${time} (${timezone})` : time;
            }
        });

        return times;
    }, [legalCases, t]);

    const rows = useMemo(() => {
        if (!legalCases?.length) return [];

        return legalCases.map((legalCase: any) => {
            const country = legalCase.customer_country || "Unknown";
            const amountOverdue = legalCase.amount_overdue || 0;
            const currency = legalCase.currency || "";

            return {
                id: legalCase.id,
                customer_id: legalCase.customer_id,
                customer: legalCase.customer,
                customer_number: legalCase.customer_number,
                amount_overdue: legalCase.amount_overdue,
                amount_formatted:
                    amountOverdue === 0
                        ? `0.00 ${currency}`
                        : `${formatAmountWithoutSymbol(amountOverdue)} ${currency}`,
                days_past_due: legalCase.days_past_due || 0,
                customer_country: country,
                customer_current_time:
                    countryTimes[country] || t("legal.unknown"),
                last_call: formatLastCall(legalCase.last_call, session),
                last_call_result: legalCase.last_call_result,
                status: legalCase.period_end_date ? "Inactive" : "Active",
                date_moved_to_legal: legalCase.date_moved_to_legal,
                raw: legalCase, // Include raw legal case data for modal access
            };
        });
    }, [legalCases, countryTimes, session, t]);

    // Export handler for legal cases
    const handleExport = useCallback(
        async (
            selectedColumns: string[],
            fileName: string,
            format: ExportFormat
        ) => {
            // Make API call to fetch ALL records for export (not just loaded ones)
            const params = new URLSearchParams({
                search: debouncedSearch,
                sortField: sortModel[0]?.field || "",
                sortDirection: sortModel[0]?.sort || "desc",
                export: "true", // Flag to indicate this is an export request
                limit: "10000", // Large limit to get all data
            });

            const response = await apiFetch(`/api/operations/legal-cases?${params.toString()}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const rawLegalCases = data.legalCases || [];

            const transformedLegalCases = rawLegalCases.map(
                (legalCase: any) => {
                    const country = legalCase.customer_country || "Unknown";
                    const amountOverdue = legalCase.amount_overdue || 0;
                    const currency = legalCase.currency || "";

                    return {
                        id: legalCase.id,
                        customer_id: legalCase.customer_id,
                        customer: legalCase.customer,
                        customer_number: legalCase.customer_number,
                        amount_formatted: formatCurrencyWithCode(
                            amountOverdue,
                            currency
                        ),
                        days_past_due: legalCase.days_past_due || 0,
                        customer_country: country,
                        customer_current_time:
                            countryTimes[country] || t("legal.unknown"),
                        last_call: formatLastCall(legalCase.last_call, session),
                        last_call_result: legalCase.last_call_result,
                        status: legalCase.period_end_date
                            ? "Inactive"
                            : "Active",
                        date_moved_to_legal: legalCase.date_moved_to_legal,
                        raw: legalCase,
                    };
                }
            );

            return transformedLegalCases;
        },
        [debouncedSearch, sortModel, countryTimes, session, t]
    );

    // Handle mass update completion
    const handleMassUpdateComplete = useCallback(async () => {
        setSelectedRows([]);
        setQueryKeyVersion((prev) => prev + 1);
        await queryClient.invalidateQueries({
            queryKey: ["legalCases-virtual"],
        });
        reset();
    }, [queryClient, reset]);

    // Actions menu handlers - use position-based approach to avoid anchor element issues
    const handleActionsMenuOpen = useCallback(
        (event: React.MouseEvent<HTMLElement>) => {
            event.preventDefault();
            event.stopPropagation();
            const target = event.currentTarget;

            // Get position immediately before element might be removed from DOM
            const rect = target.getBoundingClientRect();
            const position = {
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
            };

            setMenuPosition(position);
        },
        []
    );

    const handleActionsMenuClose = useCallback(() => {
        setMenuPosition(null);
    }, []);

    const handleMassUpdateCategory = useCallback(() => {
        handleActionsMenuClose();
        setIsMassUpdateModalOpen(true);
    }, [handleActionsMenuClose]);

    const columnVisibilityModel = useMemo(
        () => ({
            checkbox: true,
            customer: true,
            customer_number: windowWidth >= BREAKPOINTS.MOBILE,
            amount_formatted: true,
            days_past_due: true,
            status: true,
            customer_country: windowWidth >= BREAKPOINTS.DESKTOP,
            customer_current_time: windowWidth >= BREAKPOINTS.DESKTOP,
            last_call: windowWidth >= BREAKPOINTS.MOBILE,
            last_call_result: true,
            date_moved_to_legal: true,
        }),
        [windowWidth]
    );

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "checkbox",
                headerName: "",
                width: 60,
                minWidth: 60,
                maxWidth: 60,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                resizable: false,
                renderCell: (params) => (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            width: "100%",
                            cursor: "default",
                        }}
                    >
                        <Checkbox
                            checked={selectedRows.includes(params.row.id)}
                            onChange={(e) => {
                                e.stopPropagation();
                                if (e.target.checked) {
                                    setSelectedRows((prev) => [
                                        ...prev,
                                        params.row.id,
                                    ]);
                                } else {
                                    setSelectedRows((prev) =>
                                        prev.filter(
                                            (id) => id !== params.row.id
                                        )
                                    );
                                }
                            }}
                            onClick={(e) => {
                                // Only stop propagation on the checkbox itself, not the entire cell
                                // This allows clicks on the cell background to reach the row for multi-select
                                e.stopPropagation();
                            }}
                            sx={{
                                padding: 0,
                                color: theme.palette.primary.main,
                                "&.Mui-checked": {
                                    color: theme.palette.primary.main,
                                },
                            }}
                        />
                    </Box>
                ),
            },
            {
                field: "customer",
                headerName: t("fields.customer", { ns: "legal" }),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => {
                    const isRTL = i18n.language === "he";

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
                                    router.push(
                                        AppUrls.Customer_ACTIVITY(
                                            params.row.customer_id
                                        )
                                    );
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                sx={{
                                    fontWeight: 500,
                                    color: theme.palette.primary.main,
                                    cursor: "pointer",
                                    pointerEvents: "auto",
                                    textAlign: isRTL ? "right" : "left",
                                    direction: isRTL ? "rtl" : "ltr",
                                    textDecoration: "underline",
                                    textUnderlineOffset: "0.125em",
                                    width: "100%",
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
                headerName: t("fields.customer_code", { ns: "legal" }),
                flex: 1,
                minWidth: 120,
            },
            {
                field: "amount_formatted",
                headerName: t("fields.amount_overdue", { ns: "legal" }),
                flex: 1,
                minWidth: 120,
                renderCell: (params) => (
                    <Typography
                        variant="body2"
                        fontWeight={600}
                        color={
                            params.row.amount_overdue > 10000
                                ? "error.main"
                                : "inherit"
                        }
                    >
                        {params.value}
                    </Typography>
                ),
            },
            {
                field: "days_past_due",
                headerName: t("fields.days_past_due", { ns: "legal" }),
                flex: 1,
                minWidth: 140,
                renderCell: (params) => (
                    <Chip
                        label={`${params.value} ${t("fields.days")}`}
                        size="small"
                        sx={{
                            backgroundColor: getUrgencyColor(
                                params.value,
                                theme
                            ),
                            color: theme.palette.common.white,
                            fontWeight: 500,
                        }}
                    />
                ),
            },
            {
                field: "status",
                headerName: t("fields.status", { ns: "common" }),
                flex: 1,
                minWidth: 100,
                renderCell: (params) => {
                    const isActive = params.value === "Active";
                    return (
                        <Chip
                            label={params.value}
                            size="small"
                            data-status={isActive ? "active" : "inactive"}
                        />
                    );
                },
            },
            {
                field: "customer_country",
                headerName: t("fields.country", { ns: "common" }),
                flex: 1,
                minWidth: 120,
            },
            {
                field: "customer_current_time",
                headerName: t("fields.current_time"),
                flex: 1.5,
                minWidth: 180,
                renderCell: (params) => (
                    <Typography variant="body2">{params.value}</Typography>
                ),
            },
            {
                field: "last_call",
                headerName: t("fields.last_call"),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.value || t("messages.no_calls")}
                    </Typography>
                ),
            },
            {
                field: "last_call_result",
                headerName: t("fields.last_call_result"),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => {
                    // Translate in real-time from database value
                    const formattedResult = formatLastCallResult(
                        params.row.last_call_result
                    );
                    return (
                        <Typography variant="body2">
                            {formattedResult || "-"}
                        </Typography>
                    );
                },
            },
            {
                field: "date_moved_to_legal",
                headerName: t("fields.date_moved_to_legal"),
                flex: 1,
                minWidth: 150,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.value
                            ? formatDateForDisplay(
                                new Date(params.value),
                                "datetime",
                                session?.user?.locale,
                                session?.user?.timezone
                            )
                            : "-"}
                    </Typography>
                ),
            },
        ],
        [t, router, session, theme, i18n.language, selectedRows]
    );

    if (error) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "200px",
                    flexDirection: "column",
                    gap: 2,
                }}
            >
                <Typography variant="h6" color="error">
                    {t("messages.error_fetching_data")}
                </Typography>
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => window.location.reload()}
                >
                    {t("actions.retry", { ns: "common" })}
                </Button>
            </Box>
        );
    }

    if (!legalCases && isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "400px",
                }}
            >
                <CircularProgress color="primary" size={40} />
                <CircularProgress color="primary" size={40} />
            </Box>
        );
    }

    return (
        <Box sx={{ bgcolor: "background.default" }}>
            <PageHeader
                title={title}
                description={description}
            />

            {/* Stats Cards */}
            <LegalStats statsData={statsData} statsLoading={statsLoading} />

            {/* Grid - mount only after stats have loaded so viewport height is correct */}
            {statsLoading ? (
                <Box
                    sx={{
                        minHeight: 400,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "background.paper",
                        borderRadius: 1,
                    }}
                >
                    <CircularProgress />
                </Box>
            ) : (
                <Box ref={tableContainerRef}>
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
                    bulkActionButton={
                        <BulkActionButton
                            selectedRowsCount={selectedRows.length}
                            onClick={(event) => {
                                // Use event.currentTarget to get the button element directly
                                // This avoids fragile DOM queries that break in production builds
                                // (data-testid attributes are stripped in production)
                                const buttonElement = event.currentTarget;
                                const rect = buttonElement.getBoundingClientRect();
                                const position = {
                                    top: rect.bottom + window.scrollY,
                                    left: i18n.language === "he"
                                        ? rect.right + window.scrollX  // For RTL: align right edge of menu with right edge of button
                                        : rect.left + window.scrollX,  // For LTR: align left edge of menu with left edge of button
                                };
                                setMenuPosition(position);
                            }}
                        />
                    }
                    searchValue={searchQuery}
                    onSearchChange={(value) => {
                        setSearchQuery(value);
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
                        ns: "legal",
                    })}
                    noRowsDescription={t(
                        "messages.no_data_available_description",
                        {
                            ns: "legal",
                        }
                    )}
                    onExport={handleExport}
                    exportContextInfo={{
                        pageName: "legal_cases",
                        customPrefix: "legal_cases_export",
                    }}
                    // Currency columns configuration for export splitting
                    currencyColumns={
                        {
                            amount_formatted: {
                                amountField: "amount_formatted_value",
                                currencyField: "amount_formatted_currency",
                            },
                        } as CurrencyColumnsConfig
                    }
                    enableMultiSelect={true}
                    selectedRowIds={selectedRows}
                    onSelectionChange={(selectedRowIds) => {
                        setSelectedRows(selectedRowIds.map((id) => Number(id)).filter((id) => !isNaN(id)));
                    }}
                />
                </Box>
            )}

            {/* Actions Menu - Use Popover with manual positioning to avoid anchor element issues */}
            {menuPosition && (
                <Popover
                    open={Boolean(menuPosition)}
                    onClose={handleActionsMenuClose}
                    anchorReference="anchorPosition"
                    anchorPosition={menuPosition}
                    anchorOrigin={{
                        vertical: "top",
                        horizontal: i18n.language === "he" ? "right" : "left",
                    }}
                    transformOrigin={{
                        vertical: "top",
                        horizontal: i18n.language === "he" ? "right" : "left",
                    }}
                    PaperProps={{
                        sx: {
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            minWidth: 220,
                            mt: 0.5,
                        },
                    }}
                >
                    <MenuItem onClick={handleMassUpdateCategory}>
                        <ListItemIcon>
                            <Category fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>
                            {t("actions.mass_update_category", {
                                ns: "activities",
                            })}
                        </ListItemText>
                    </MenuItem>
                </Popover>
            )}

            {/* Mass Update Category Modal */}
            <MassUpdateCategoryModal
                isOpen={isMassUpdateModalOpen}
                closeModal={() => setIsMassUpdateModalOpen(false)}
                selectedRows={rows.filter((row) =>
                    selectedRows.includes(row.id)
                )}
                onUpdateComplete={handleMassUpdateComplete}
                currentCategory="Legal"
            />
        </Box>
    );
};

export default LegalList;
