"use client";

import { Edit, FilterList, Refresh, Share, Sync } from "@mui/icons-material";
import {
    Alert,
    Box,
    Paper,
    Typography,
    useTheme,
    IconButton,
    Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import React, {
    useMemo,
    useState,
    useCallback,
    useRef,
    useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import api, { apiFetch } from "@/app/api";
import ReportViewerFiltersModal from "@/components/reports/ReportViewerFiltersModal";
import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { generateViewColumns } from "@/shared/utils/viewColumnGenerator";
import { isFormulaOutputKey } from "@/shared/reportFormula/types";
import AppUrls from "@/utils/appUrls";
import {
    cloneReportFilters,
    type Field,
    getFieldOutputKey,
    type ReportFilterRow,
    type ReportMetadataTable,
    resolveLegacyFieldOutputKey,
} from "@/utils/reportTableUtils";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
});

// Constants
const PAGE_LIMIT = 20;
const CHART_DATA_LIMIT = 10000;
const CHART_TYPE_MAP: Record<string, "pie" | "bar" | "line" | "area"> = {
    pie: "pie",
    bar: "bar",
    line: "line",
    area: "area",
};

interface ReportViewerProps {
    reportId: number;
    reportName?: string;
    reportConfig: any;
    allTables?: ReportMetadataTable[];
    hasEditReportPermission?: boolean;
    hasShareReportPermission?: boolean;
    hasExportReportPermission?: boolean;
    isSystemReport?: boolean;
    onEditClick?: () => void;
    onShareClick?: () => void;
}

const ReportViewer: React.FC<ReportViewerProps> = ({
    reportId,
    reportName,
    reportConfig,
    allTables = [],
    hasEditReportPermission = false,
    hasShareReportPermission = false,
    hasExportReportPermission = false,
    isSystemReport = false,
    onEditClick,
    onShareClick,
}) => {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const theme = useTheme();
    const router = useRouter();
    const queryClient = useQueryClient();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const { data: session } = useSession();
    const { success, error: showError } = useToast();
    const accountCurrency = session?.user?.currency;
    const isAdmin = session?.user?.account_id === 10013;

    // Search state with debouncing
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);

    const [filterModalOpen, setFilterModalOpen] = useState(false);
    const [syncConfirmationOpen, setSyncConfirmationOpen] = useState(false);
    const [sessionFilterOverrides, setSessionFilterOverrides] = useState<
        ReportFilterRow[] | null
    >(null);

    const savedReportFilters = useMemo(
        () => cloneReportFilters(reportConfig?.filters ?? []),
        [reportConfig?.filters]
    );

    const hasReportFilters = (reportConfig?.filters?.length ?? 0) > 0;

    const primaryTableName = useMemo(() => {
        return reportConfig?.fields?.[0]?.table || "Customer";
    }, [reportConfig?.fields]);

    // Initialize sortModel from reportConfig.sorting if available
    // The sort field format should match: alias || table.field || field
    const initialSortModel = useMemo<GridSortModel>(() => {
        if (reportConfig?.sorting && reportConfig.sorting.length > 0) {
            const sortConfig = reportConfig.sorting[0];
            if (isFormulaOutputKey(sortConfig.field)) {
                return [];
            }
            // Map report config sorting format to GridSortModel format
            // reportConfig.sorting: { field: string, direction: "ASC" | "DESC" }
            // GridSortModel: { field: string, sort: "asc" | "desc" }
            // The field should already be in the correct format (alias || table.field || field)
            return [{
                field: sortConfig.field,
                sort: sortConfig.direction.toLowerCase() as "asc" | "desc",
            }];
        }
        return [];
    }, [reportConfig?.sorting]);

    // Sorting state - initialize from reportConfig
    const [sortModel, setSortModel] = useState<GridSortModel>(initialSortModel);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);
    const hasUserChangedSort = useRef(false);
    const prevReportConfigRef = useRef(reportConfig);
    
    // Update sortModel when reportConfig changes (only if user hasn't manually changed it)
    useEffect(() => {
        // Only reset if reportConfig actually changed (not just columns)
        const reportConfigChanged = prevReportConfigRef.current !== reportConfig;
        if (reportConfigChanged && initialSortModel.length > 0 && !hasUserChangedSort.current) {
            setSortModel(initialSortModel);
            prevReportConfigRef.current = reportConfig;
        }
    }, [initialSortModel, reportConfig]);

    // Extract sort field and direction for API calls
    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort;

    const getViewerExecutionParams = useCallback(() => {
        const params: {
            filters?: ReportFilterRow[];
            replaceConfigFilters?: boolean;
            search?: string;
            sortField?: string;
            sortDirection?: "asc" | "desc";
        } = {};

        if (sessionFilterOverrides && sessionFilterOverrides.length > 0) {
            params.filters = sessionFilterOverrides;
            params.replaceConfigFilters = true;
        }
        if (debouncedSearch) {
            params.search = debouncedSearch;
        }
        if (sortField) {
            params.sortField = sortField;
        }
        if (sortDirection) {
            params.sortDirection = sortDirection;
        }
        return params;
    }, [
        sessionFilterOverrides,
        debouncedSearch,
        sortField,
        sortDirection,
    ]);

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);

    // Create query key - match CustomerList pattern exactly
    const queryKey = useMemo(() => {
        return [
            "report-execution",
            {
                reportId,
                query: debouncedSearch,
                sortField: sortField || undefined,
                sortDirection: sortDirection || undefined,
                sessionFilters: sessionFilterOverrides,
                version: queryKeyVersion,
            },
        ];
    }, [
        reportId,
        debouncedSearch,
        sortField,
        sortDirection,
        sessionFilterOverrides,
        queryKeyVersion,
    ]);

    const executeQueryFn = useCallback(
        async (page: number = 1) => {
            const requestBody: Record<string, unknown> = {
                page,
                limit: PAGE_LIMIT,
                ...getViewerExecutionParams(),
            };

            const response = await apiFetch(`/api/reports/${reportId}/execute`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const returnedData = data.data || [];
            const total = data.totalRecords || 0;

            return {
                data: returnedData,
                totalRecords: total,
                hasMore: returnedData.length > 0 && page * PAGE_LIMIT < total,
                aggregationTotals: data.aggregationTotals as
                    | Record<string, number>
                    | undefined,
                formulaWarnings: data.formulaWarnings as
                    | Array<{
                          formulaId: string;
                          label: string;
                          invalidCount: number;
                      }>
                    | undefined,
            };
        },
        [reportId, getViewerExecutionParams]
    );

    // Use virtual infinite scroll hook
    const {
        data: reportData,
        totalRecords,
        aggregationTotals,
        formulaWarnings,
        isLoading,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey,
        queryFn: executeQueryFn,
        pageSize: PAGE_LIMIT,
    });

    const { data: chartDataResponse } = useQuery({
        queryKey: [
            "report-chart-data",
            reportId,
            sessionFilterOverrides,
            debouncedSearch,
            sortField,
            sortDirection,
            queryKeyVersion,
        ],
        queryFn: async () => {
            const response = await apiFetch(`/api/reports/${reportId}/execute`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    page: 1,
                    limit: CHART_DATA_LIMIT,
                    ...getViewerExecutionParams(),
                }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        },
        enabled:
            !!reportId &&
            !!reportConfig?.chart &&
            reportConfig.chart.type !== "table",
    });

    const chartConfig = reportConfig?.chart;
    const chartData = chartDataResponse?.chartData || [];

    const chartOptions = useMemo(() => {
        if (!chartConfig || chartConfig.type === "table" || !chartData.length) {
            return null;
        }

        const chartColors = [
            theme.palette.chartPalette.dark,
            theme.palette.chartPalette.main,
            theme.palette.chartPalette.light,
            `${theme.palette.chartPalette.main}99`,
            `${theme.palette.chartPalette.main}4D`,
        ];
        const chartType = CHART_TYPE_MAP[chartConfig.type] || "bar";
        const extractChartValue = (
            item: Record<string, any>,
            index: number
        ) => {
            if (item.name !== undefined) return item.name;
            if (item.value !== undefined) return item.value;
            const keys = Object.keys(item);
            return item[keys[index]] || (index === 0 ? "" : 0);
        };

        const baseOptions: ApexOptions = {
            chart: {
                type: chartType,
                background: "#F3F6FA",
                foreColor: "#2F3B52",
                toolbar: { show: true },
                animations: { enabled: true, speed: 800 },
            },
            colors: chartColors,
            grid: {
                borderColor: "#DCE3EB",
                strokeDashArray: 5,
            },
            title: {
                text: chartConfig.title || "",
                style: {
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#2F3B52",
                },
            },
            legend: {
                position: "bottom",
            },
        };

        if (chartConfig.type === "pie") {
            return {
                ...baseOptions,
                labels: chartData.map((item: Record<string, any>) =>
                    extractChartValue(item, 0)
                ),
                series: chartData.map((item: Record<string, any>) =>
                    extractChartValue(item, 1)
                ),
            };
        }

        const categories = chartData.map((item: Record<string, any>) =>
            extractChartValue(item, 0)
        );
        const seriesData = chartData.map((item: Record<string, any>) =>
            extractChartValue(item, 1)
        );
        const xField =
            resolveLegacyFieldOutputKey(
                chartConfig.xAxis,
                reportConfig.fields
            ) ||
            (reportConfig.fields?.[0]
                ? getFieldOutputKey(reportConfig.fields[0])
                : undefined) ||
            reportConfig.fields?.[0]?.field ||
            "Category";
        const firstAggField = reportConfig.fields?.find(
            (f: any) => f.aggregation
        );
        const yField =
            resolveLegacyFieldOutputKey(
                chartConfig.yAxis,
                reportConfig.fields
            ) ||
            (firstAggField ? getFieldOutputKey(firstAggField) : undefined) ||
            "Value";

        return {
            ...baseOptions,
            xaxis: {
                categories,
                title: {
                    text: xField,
                    style: { color: "#7C8DA1", fontSize: "12px" },
                },
            },
            yaxis: {
                title: {
                    text: yField,
                    style: { color: "#7C8DA1", fontSize: "12px" },
                },
            },
            series: [
                {
                    name: yField || "Value",
                    data: seriesData,
                },
            ],
        };
    }, [chartConfig, chartData, reportConfig, theme.palette.chartPalette]);

    const rows = useMemo(() => {
        return reportData.map((row: any, index: number) => ({
            id: row.id || `report-${reportId}-row-${index}`,
            ...row,
            raw: row,
        }));
    }, [reportData, reportId]);

    // Export function - fetches all data and applies same transformation as grid rows
    const handleExport = useCallback(
        async (
            selectedColumns: string[],
            fileName: string,
            format: "csv" | "excel" | "pdf"
        ): Promise<any[]> => {
            const executionParams = getViewerExecutionParams();

            // For PDF export, use the API endpoint directly
            if (format === "pdf") {
                try {
                    const columnsParam = encodeURIComponent(
                        JSON.stringify(selectedColumns)
                    );
                    const queryParts = [
                        `format=pdf`,
                        `columns=${columnsParam}`,
                    ];
                    if (
                        executionParams.filters &&
                        executionParams.filters.length > 0
                    ) {
                        queryParts.push(
                            `filters=${encodeURIComponent(JSON.stringify(executionParams.filters))}`
                        );
                        queryParts.push("replaceConfigFilters=true");
                    }
                    if (executionParams.search) {
                        queryParts.push(
                            `search=${encodeURIComponent(executionParams.search)}`
                        );
                    }
                    if (executionParams.sortField) {
                        queryParts.push(
                            `sortField=${encodeURIComponent(executionParams.sortField)}`
                        );
                    }
                    if (executionParams.sortDirection) {
                        queryParts.push(
                            `sortDirection=${encodeURIComponent(executionParams.sortDirection)}`
                        );
                    }
                    const response = await apiFetch(
                        `/api/reports/${reportId}/export?${queryParts.join("&")}`,
                        {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error(
                            `HTTP error! status: ${response.status}`
                        );
                    }

                    // Get the PDF blob
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${fileName}.pdf`;

                    // Trigger download
                    document.body.appendChild(link);
                    link.click();

                    // Cleanup
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);

                    // Return empty array since PDF is handled separately
                    return [];
                } catch (error) {
                    throw new Error(
                        `Failed to export PDF: ${error instanceof Error ? error.message : "Unknown error"}`
                    );
                }
            }

            // For CSV and Excel, fetch data and return it
            const requestBody: Record<string, unknown> = {
                page: 1,
                limit: 10000,
                ...executionParams,
            };

            const response = await apiFetch(`/api/reports/${reportId}/execute`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const rawData = data.data || [];

            // Apply same transformation as grid rows
            return rawData.map((row: any, index: number) => ({
                id: row.id || `report-${reportId}-row-${index}`,
                ...row,
                raw: row,
            }));
        },
        [reportId, getViewerExecutionParams]
    );

    // Determine the context based on the primary table name
    // Use "disputes" context for dispute reports, otherwise "reports"
    const reportContext = useMemo(() => {
        if (primaryTableName === "Dispute") {
            return "disputes";
        }
        // Check if any field is from Dispute table
        const hasDisputeFields = reportConfig?.fields?.some(
            (field: any) => field.table === "Dispute"
        );
        if (hasDisputeFields) {
            return "disputes";
        }
        return "reports";
    }, [primaryTableName, reportConfig?.fields]);

    const linkHandlers = useMemo(
        () => ({
            customer: (id: number, tab?: string) => {
                const tabParam = tab ? `?tab=${tab}` : "";
                return `/${locale}${AppUrls.Customer_DETAILS(id)}${tabParam}`;
            },
            dispute: (id: number, tab?: string) => {
                // tab contains "outstanding-activities-tab&openDispute=X"
                const tabParam = tab ? `?activeTab=${tab}` : "";
                return `/${locale}${AppUrls.Customer_DETAILS(id)}${tabParam}`;
            },
        }),
        [locale]
    );

    const columns: GridColDef[] = useMemo(() => {
        if (!reportConfig?.fields) {
            return [];
        }

        // Generate columns even when there are no rows - this ensures headers are shown correctly
        // generateViewColumns handles empty rows by using viewConfig.fields to determine columns
        return generateViewColumns({
            viewConfig: reportConfig,
            rows,
            tablesMetadata: allTables,
            context: reportContext,
            tableName: primaryTableName,
            theme,
            router: router as any,
            i18n,
            t,
            linkHandlers,
            enableAggregation: true,
            rawData: reportData,
            accountCurrency,
            aggregationTotals,
        });
    }, [
        reportConfig,
        rows,
        reportData,
        allTables,
        primaryTableName,
        reportContext,
        theme,
        router,
        i18n,
        t,
        linkHandlers,
        accountCurrency,
        aggregationTotals,
    ]);

    /** Bust fillViewport cache when report shape changes (e.g. after save) — RO does not see sibling reflow. */
    const fillViewportRecalcKey = useMemo(() => {
        const chartPart =
            reportConfig?.chart &&
            reportConfig.chart.type !== "table"
                ? String(!!chartDataResponse)
                : "no-chart";
        const fields = reportConfig?.fields || [];
        const fieldSig = fields
            .map((f: any) => getFieldOutputKey(f as Field))
            .join("|");
        const formulaSig = (reportConfig?.formulas || [])
            .map((f: any) => `${f.id}:${f.label}`)
            .join("|");
        const orderSig = (reportConfig?.columnOrder || []).join("|");
        return `${chartPart}:${columns.length}:${fieldSig}:${formulaSig}:${orderSig}`;
    }, [
        reportConfig?.chart,
        reportConfig?.chart?.type,
        reportConfig?.fields,
        reportConfig?.formulas,
        reportConfig?.columnOrder,
        chartDataResponse,
        columns.length,
    ]);

    // Reset user sort flag when report changes
    useEffect(() => {
        hasUserChangedSort.current = false;
        prevReportConfigRef.current = reportConfig;
    }, [reportId]);

    // Handle sort model change - track user-initiated changes
    const handleSortModelChange = useCallback((newSortModel: GridSortModel) => {
        const field = newSortModel[0]?.field;
        if (field && isFormulaOutputKey(field)) {
            return;
        }
        hasUserChangedSort.current = true;
        setSortModel(newSortModel);
    }, []);

    const handleRefresh = useCallback(() => {
        setSessionFilterOverrides(null);
        setQueryKeyVersion((prev) => prev + 1);
        reset();
        queryClient.invalidateQueries({ queryKey: ["report-chart-data", reportId] });
    }, [reset, queryClient, reportId]);

    const handleFilterApply = useCallback(
        (filters: ReportFilterRow[] | null) => {
            setSessionFilterOverrides(filters);
            setQueryKeyVersion((prev) => prev + 1);
            reset();
            queryClient.invalidateQueries({
                queryKey: ["report-chart-data", reportId],
            });
        },
        [reset, queryClient, reportId]
    );

    const syncReportsMutation = useMutation({
        mutationFn: async (reportIds: number[]) => {
            const response = await api.post("/api/reports/sync-system", {
                reportIds,
            });
            return response.data as {
                syncedReports: number;
                targetAccounts: number;
                created: number;
                updated: number;
            };
        },
        onSuccess: (data) => {
            setSyncConfirmationOpen(false);
            success(
                t("messages.sync_success", {
                    ns: "reports",
                    defaultValue:
                        "Synced {{syncedReports}} reports to {{targetAccounts}} accounts.",
                    syncedReports: data.syncedReports,
                    targetAccounts: data.targetAccounts,
                })
            );
        },
        onError: (error: any) => {
            showError(
                error.response?.data?.error ||
                    t("messages.sync_error", {
                        ns: "reports",
                        defaultValue: "Failed to sync reports",
                    })
            );
        },
    });

    const confirmSync = useCallback(async () => {
        await syncReportsMutation.mutateAsync([reportId]);
    }, [reportId, syncReportsMutation]);

    const tableContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;

        if (searchChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            setQueryKeyVersion((prev) => prev + 1);
            reset();
        }
    }, [debouncedSearch, reset]);

    useEffect(() => {
        const findScrollableContainer = (): HTMLElement | null => {
            if (!tableContainerRef.current) return null;

            const allDivs =
                tableContainerRef.current.querySelectorAll<HTMLElement>("div");

            for (const div of Array.from(allDivs)) {
                const style = window.getComputedStyle(div);
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
            // Let open modals (export, filters, etc.) handle their own scroll
            const eventTarget =
                e.target instanceof Element ? e.target : null;
            if (eventTarget?.closest('[role="dialog"]')) {
                return;
            }

            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                return;
            }

            const container = findScrollableContainer();
            if (!container) {
                return;
            }

            const containerRect = container.getBoundingClientRect();
            const isVisible =
                containerRect.top < window.innerHeight &&
                containerRect.bottom > 0 &&
                containerRect.width > 0 &&
                containerRect.height > 0;

            if (!isVisible) {
                return;
            }

            const { scrollTop, scrollHeight, clientHeight } = container;
            const canScrollUp = scrollTop > 0;
            const canScrollDown = scrollTop < scrollHeight - clientHeight;
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

        window.addEventListener("wheel", handleWheel, { passive: false });
        return () => window.removeEventListener("wheel", handleWheel);
    }, []);

    const isHebrewUser = i18n.language === "he";

    const iconButtonSx = useMemo(
        () => ({
            width: 32,
            height: 32,
            borderRadius: 2,
            "&:hover": {
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
        }),
        [theme]
    );

    const ReportActionButtons = useMemo(() => {
        const ActionButton = ({
            title,
            onClick,
            icon: Icon,
            disabled,
            showOverrideHint,
        }: {
            title: string;
            onClick: () => void;
            icon: React.ElementType;
            disabled?: boolean;
            showOverrideHint?: boolean;
        }) => {
            return (
                <Tooltip
                    title={title}
                    arrow
                    enterDelay={300}
                    leaveDelay={100}
                    placement="bottom"
                    PopperProps={{
                        sx: {
                            "& .MuiTooltip-tooltip": {
                                direction: isHebrewUser ? "rtl" : "ltr",
                            },
                            "& .MuiTooltip-arrow": {
                                ...(isHebrewUser && {
                                    transform: "scaleX(-1)",
                                }),
                            },
                        },
                    }}
                >
                    <Box sx={{ position: "relative", display: "inline-flex" }}>
                        {disabled ? (
                            <span>
                                <IconButton
                                    color={
                                        showOverrideHint
                                            ? "secondary"
                                            : "primary"
                                    }
                                    onClick={onClick}
                                    disabled={disabled}
                                    sx={iconButtonSx}
                                >
                                    <Icon fontSize="small" />
                                </IconButton>
                            </span>
                        ) : (
                            <IconButton
                                color={
                                    showOverrideHint ? "secondary" : "primary"
                                }
                                onClick={onClick}
                                disabled={disabled}
                                sx={iconButtonSx}
                            >
                                <Icon fontSize="small" />
                            </IconButton>
                        )}
                        {showOverrideHint && (
                            <Box
                                sx={{
                                    position: "absolute",
                                    top: 4,
                                    right: isHebrewUser ? "auto" : 4,
                                    left: isHebrewUser ? 4 : "auto",
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor: "secondary.main",
                                }}
                            />
                        )}
                    </Box>
                </Tooltip>
            );
        };

        // Disable edit if it's a system report and user is not admin
        const isEditDisabled = isSystemReport && !isAdmin;

        return (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <ActionButton
                    title={t("actions.refresh_report", {
                        ns: "reports",
                        defaultValue: "Refresh report",
                    })}
                    onClick={handleRefresh}
                    icon={Refresh}
                />
                <ActionButton
                    title={
                        hasReportFilters
                            ? t("actions.edit_filters", {
                                  defaultValue: "Edit filters",
                              })
                            : t("messages.no_filters", {
                                  defaultValue:
                                      "No filters configured for this report.",
                              })
                    }
                    onClick={() => setFilterModalOpen(true)}
                    icon={FilterList}
                    disabled={!hasReportFilters}
                    showOverrideHint={
                        hasReportFilters && sessionFilterOverrides !== null
                    }
                />
                {hasEditReportPermission && onEditClick && (
                    <ActionButton
                        title={
                            isEditDisabled
                                ? t("messages.cannot_edit_system_report", {
                                      ns: "reports",
                                  })
                                : t("actions.edit_report", {
                                      ns: "reports",
                                  })
                        }
                        onClick={onEditClick}
                        icon={Edit}
                        disabled={isEditDisabled}
                    />
                )}
                {hasShareReportPermission && onShareClick && (
                    <ActionButton
                        title={t("actions.share")}
                        onClick={onShareClick}
                        icon={Share}
                    />
                )}
                {isAdmin && isSystemReport && (
                    <ActionButton
                        title={t("actions.sync_to_all_accounts", {
                            ns: "reports",
                            defaultValue: "Sync to all accounts",
                        })}
                        onClick={() => setSyncConfirmationOpen(true)}
                        icon={Sync}
                        disabled={syncReportsMutation.isPending}
                    />
                )}
            </Box>
        );
    }, [
        handleRefresh,
        hasReportFilters,
        sessionFilterOverrides,
        hasEditReportPermission,
        hasShareReportPermission,
        onEditClick,
        onShareClick,
        isSystemReport,
        isAdmin,
        syncReportsMutation.isPending,
        t,
        iconButtonSx,
        isHebrewUser,
    ]);

    if (error) {
        return (
            <Paper sx={{ p: 3 }}>
                <Typography color="error">
                    {t(
                        "messages.error_fetching_data",
                        "Error fetching report data"
                    )}
                </Typography>
            </Paper>
        );
    }

    // Stack chart + grid like CustomerList stacks stats + grid: no flex/minHeight
    // so fillViewport measures from a stable wrapper (same idea as ViewBasedDataGrid shell).
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                width: "100%",
            }}
        >
            {chartConfig && chartConfig.type !== "table" && chartOptions && (
                <Paper
                    sx={{
                        p: 3,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                    }}
                >
                    <Box sx={{ minHeight: 400 }}>
                        <ReactApexChart
                            options={chartOptions as ApexOptions}
                            series={(chartOptions as any).series}
                            type={
                                chartConfig.type === "pie"
                                    ? "pie"
                                    : (chartConfig.type as
                                          | "bar"
                                          | "line"
                                          | "area")
                            }
                            height={400}
                        />
                    </Box>
                </Paper>
            )}

            {formulaWarnings && formulaWarnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 0 }}>
                    {formulaWarnings.map((w) =>
                        t("formulas.warning_summary", {
                            label: w.label,
                            count: w.invalidCount,
                            defaultValue:
                                "{{label}}: {{count}} invalid calculation(s)",
                        })
                    ).join(" · ")}
                </Alert>
            )}

            <Box
                ref={tableContainerRef}
                sx={{
                    position: "relative",
                    isolation: "isolate",
                    // Match CustomerList: override toolbar alignment so dropdown aligns with custom buttons
                    "& .endless-scroll-toolbar": {
                        "& > div:first-of-type": {
                            display: "flex",
                            alignItems: "center",
                            "& > div:first-of-type": {
                                display: "flex",
                                alignItems: "center",
                                "& .MuiAutocomplete-root": {
                                    display: "flex",
                                    alignItems: "center",
                                    "& .MuiOutlinedInput-root": {
                                        display: "flex",
                                        alignItems: "center",
                                    },
                                },
                            },
                        },
                    },
                }}
            >
                <EndlessScrollDataGrid
                    key={`${reportId}-${debouncedSearch}-${JSON.stringify(sortModel)}-${queryKeyVersion}`}
                    customButtons={ReportActionButtons}
                    viewportRecalcDependency={fillViewportRecalcKey}
                    rows={rows}
                    columns={columns}
                    totalRecords={totalRecords}
                    isLoading={isLoading}
                    onLoadMore={loadMore}
                    hasMore={hasMore}
                    sortModel={sortModel}
                    onSortModelChange={handleSortModelChange}
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
                    exportDisabled={!hasExportReportPermission}
                    exportContextInfo={{
                        pageName: reportName || "report-viewer",
                        customPrefix: reportName
                            ? reportName
                                  .replace(/[^a-zA-Z0-9\s]/g, "")
                                  .replace(/\s+/g, "_")
                                  .substring(0, 50)
                            : `report_${reportId}`,
                    }}
                    noRowsMessage={t("messages.no_results", {
                        ns: "common",
                    })}
                    noRowsDescription={t("messages.no_results_description", {
                        ns: "common",
                    })}
                />
            </Box>

            {hasReportFilters && (
                <ReportViewerFiltersModal
                    open={filterModalOpen}
                    onClose={() => setFilterModalOpen(false)}
                    savedFilters={savedReportFilters}
                    initialFilters={
                        sessionFilterOverrides ?? savedReportFilters
                    }
                    selectedTables={reportConfig?.tables ?? []}
                    tables={allTables}
                    onApply={handleFilterApply}
                />
            )}

            <DeleteDialog
                isOpen={syncConfirmationOpen}
                onClose={() => setSyncConfirmationOpen(false)}
                onConfirm={confirmSync}
                title={t("messages.sync_confirm_title", {
                    ns: "reports",
                    defaultValue: "Sync selected reports",
                })}
                description={t("messages.sync_confirm_description", {
                    ns: "reports",
                    defaultValue:
                        "This will sync {{count}} selected system report(s) from the master admin account to all other active accounts. Continue?",
                    count: 1,
                })}
                confirmLabel={t("actions.sync", {
                    ns: "reports",
                    defaultValue: "Sync",
                })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={syncReportsMutation.isPending}
                showConfirmSpinner={false}
                type="info"
                maxWidth="sm"
                locale={i18n.language}
                errorMessage={
                    syncReportsMutation.error
                        ? (syncReportsMutation.error as any)?.response?.data
                              ?.error ||
                          t("messages.sync_error", {
                              ns: "reports",
                              defaultValue: "Failed to sync reports",
                          })
                        : undefined
                }
            />
        </Box>
    );
};

export default ReportViewer;
