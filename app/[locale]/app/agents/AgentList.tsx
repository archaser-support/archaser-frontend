"use client";
import { apiFetch } from "@/utils/apiFetch";
import {
    Group as GroupIcon,
    Category,
    RemoveCircleOutline as RemoveCircleOutlineIcon,
} from "@mui/icons-material";
import ClearIcon from "@mui/icons-material/Clear";
import {
    Button,
    Box,
    Typography,
    Chip,
    CircularProgress,
    Checkbox,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Popover,
    Tabs,
    Tab,
    IconButton,
    Tooltip,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import {
    GridSortModel,
    GridColDef,
    GridRenderCellParams,
} from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import moment from "moment";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import React, { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import PageHeader from "@/components/PageHeader";

// Dynamically import modal to prevent CSS chunking issues
const MassUpdateCategoryModal = dynamic(
    () => import("@/app/[locale]/app/customers/components/MassUpdateCategoryModal").then((mod) => mod.default),
    {
        ssr: false,
        loading: () => null,
    }
);
import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import { BulkActionButton } from "@/shared/components/BulkActionButton";
import EndlessScrollDataGrid, {
    useWindowWidth,
    BREAKPOINTS,
    useVirtualInfiniteScroll,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { GRID_CONSTANTS } from "@/shared/layout-components/grid/constants";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    fetchDisputeWithAgentsStats,
    fetchAgentsWithFollowUpCall,
} from "@/shared/services/agentService";
import {
    formatCurrencyWithCode,
    CurrencyColumnsConfig,
    ExportFormat,
} from "@/shared/utility/exportToExcel";
import { CustomerAgent } from "@/types/CustomerWithAgentDispute";
import AppUrls from "@/utils/appUrls";
import { formatCallOutcome } from "@/utils/callFormatters";
import {
    formatDateForDisplay,
    getCurrentTimeForCountry,
    getCountryTimezone,
} from "@/utils/datetimeOperations";
import {
    formatAmountWithoutSymbol,
    formatCurrencyWithRTLSupport,
} from "@/utils/stringFormatters";

import AgentStats from "./components/AgentStats";

const _rowsPerPage = 20;

/** Tab indices: All Customers first, Follow-up second (plan section 2) */
const ALL_CUSTOMERS_TAB = 0;
const FOLLOW_UP_TAB = 1;

/**
 * Map grid sort field to API sort field.
 * - amount_formatted -> amount_overdue for both tabs.
 * - On Follow-up tab, API only supports last_call and follow_up_time; map other sortable columns to follow_up_time.
 */
function mapSortFieldToApi(
    gridField: string | undefined,
    isFollowUpTab: boolean
): string {
    if (!gridField) return isFollowUpTab ? "follow_up_time" : "last_call";
    if (gridField === "amount_formatted") return "amount_overdue";
    if (isFollowUpTab) {
        const unsupportedToFollowUp = [
            "customer",
            "customer_number",
            "amount_formatted",
            "amount_overdue",
            "days_past_due",
            "last_call_result",
            "customer_country",
        ];
        if (unsupportedToFollowUp.includes(gridField)) return "follow_up_time";
        if (gridField === "last_call" || gridField === "follow_up_time")
            return gridField;
        return "follow_up_time";
    }
    return gridField;
}

interface AgentListProps {
    clientType?: "All" | "Person" | "Company";
    title: string;
    description: string;
}

const AgentList: React.FC<AgentListProps> = ({
    clientType,
    title,
    description,
}) => {
    const { t, i18n } = useTranslation([
        "agents",
        "common",
        "activities",
        "disputes",
    ]);
    const router = useRouter();
    const { data: session } = useSession();
    const theme = useTheme();
    const windowWidth = useWindowWidth();
    // Extract outcome options dynamically from translation keys (same order as LogActivity)
    const outcomeSelectOptions = useMemo(() => {
        const outcomeKeys = [
            "no_answer",
            "bad_number",
            "schedule_follow_up",
            "promise_to_pay",
            "make_payment",
            "open_dispute",
            "add_new_contact",
            "general",
            "move_to_legal",
        ];
        return outcomeKeys.map((key) => ({
            value: key,
            label: t(`values.outcomes_${key}`, { ns: "activities" }),
        }));
    }, [t]);

    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [selectedOutcome, setSelectedOutcome] = useState<any>(null);
    const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<any>(null);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "last_call", sort: "asc" },
    ]);
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [isMassUpdateModalOpen, setIsMassUpdateModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<number>(ALL_CUSTOMERS_TAB); // 0 = All Customers, 1 = Follow-up
    const [followUpDateRange, setFollowUpDateRange] = useState<
        "this_week" | "next_week" | "this_month" | "all" | "today"
    >("all");
    // Actions menu state - using position instead of anchor element to avoid DOM issues
    const [menuPosition, setMenuPosition] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const queryClient = useQueryClient();
    const { showToast: _showToast } = useToast();
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const prevSelectedOutcomeRef = useRef(selectedOutcome);
    const prevSelectedBusinessUnitRef = useRef(selectedBusinessUnit);
    const prevClientTypeRef = useRef(clientType);
    const prevFollowUpDateRangeRef = useRef(followUpDateRange);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);

    // Fetch follow-up count early - needed for effectiveActiveTab before queryKey/queryFn
    // Use followUpDateRange: "all" so the tab shows when there are ANY follow-ups,
    // regardless of the date range filter (which only affects the displayed list)
    const { data: followUpCountData } = useQuery({
        queryKey: [
            "agentsWithFollowUpCall",
            {
                page: 1,
                limit: 1,
                search: "",
                followUpDateRange: "all",
            },
        ],
        queryFn: fetchAgentsWithFollowUpCall,
        select: (data) => data?.totalRecords || 0,
        refetchOnWindowFocus: false,
    });

    const followUpCount = followUpCountData || 0;
    const showFollowUpTab = followUpCount > 0;
    const effectiveActiveTab = showFollowUpTab ? activeTab : ALL_CUSTOMERS_TAB;

    // Query key for All Customers tab (stable; no tab in key)
    const queryKeyAll = useMemo(
        () => [
            "agents-virtual",
            {
                query: debouncedSearch,
                outcome: selectedOutcome?.value || "",
                businessUnitId: selectedBusinessUnit?.id || "",
                filter: clientType,
                sortField: sortModel[0]?.field,
                sortDirection: sortModel[0]?.sort,
                version: queryKeyVersion,
            },
        ],
        [
            debouncedSearch,
            selectedOutcome?.value,
            selectedBusinessUnit?.id,
            clientType,
            sortModel[0]?.field,
            sortModel[0]?.sort,
            queryKeyVersion,
        ]
    );

    // Query key for Follow-up tab (stable; separate from All)
    const queryKeyFollowUp = useMemo(
        () => [
            "agents-follow-up-virtual",
            {
                query: debouncedSearch,
                businessUnitId: selectedBusinessUnit?.id || "",
                sortField: sortModel[0]?.field,
                sortDirection: sortModel[0]?.sort,
                version: queryKeyVersion,
                followUpDateRange,
            },
        ],
        [
            debouncedSearch,
            selectedBusinessUnit?.id,
            sortModel[0]?.field,
            sortModel[0]?.sort,
            queryKeyVersion,
            followUpDateRange,
        ]
    );

    // Query function for All Customers tab only
    const queryFnAll = useMemo(() => {
        return async (page: number = 1) => {
            const endpoint = "/api/system/agents";
            const apiSortField = mapSortFieldToApi(
                sortModel[0]?.field,
                false
            );
            const baseParams = {
                search: debouncedSearch,
                outcome: selectedOutcome?.value || "",
                businessUnitId: selectedBusinessUnit?.id || "",
                sortField: apiSortField,
                sortDirection: sortModel[0]?.sort || "asc",
            };
            const filteredParams = Object.fromEntries(
                Object.entries(baseParams).filter(
                    ([, value]) =>
                        value !== "" && value !== null && value !== undefined
                )
            );
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: GRID_CONSTANTS.DEFAULT_PAGE_SIZE.toString(),
                ...filteredParams,
            });
            const fullUrl = `${endpoint}?${queryParams}`;
            const response = await fetch(fullUrl, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const currency = data.currency || "";
            const agents = (data.agents || []).map((agent: CustomerAgent) => ({
                ...agent,
                currency,
            }));
            return {
                data: agents,
                totalRecords: data.totalRecords || 0,
                hasMore:
                    agents.length > 0 &&
                    page <
                    Math.ceil(
                        (data.totalRecords || 0) /
                        GRID_CONSTANTS.DEFAULT_PAGE_SIZE
                    ),
            };
        };
    }, [
        debouncedSearch,
        selectedOutcome,
        selectedBusinessUnit,
        sortModel,
    ]);

    // Query function for Follow-up tab only
    const queryFnFollowUp = useMemo(() => {
        return async (page: number = 1) => {
            const endpoint = "/api/system/agents/follow-up";
            const apiSortField = mapSortFieldToApi(
                sortModel[0]?.field,
                true
            );
            const baseParams = {
                search: debouncedSearch,
                sortField: apiSortField,
                sortDirection: sortModel[0]?.sort || "asc",
                businessUnitId: selectedBusinessUnit?.id || "",
                followUpDateRange,
            };
            const filteredParams = Object.fromEntries(
                Object.entries(baseParams).filter(
                    ([, value]) =>
                        value !== "" && value !== null && value !== undefined
                )
            );
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: GRID_CONSTANTS.DEFAULT_PAGE_SIZE.toString(),
                ...filteredParams,
            });
            const fullUrl = `${endpoint}?${queryParams}`;
            const response = await fetch(fullUrl, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const currency = data.currency || "";
            const agents = (data.agents || []).map((agent: CustomerAgent) => ({
                ...agent,
                currency,
            }));
            return {
                data: agents,
                totalRecords: data.totalRecords || 0,
                hasMore:
                    agents.length > 0 &&
                    page <
                    Math.ceil(
                        (data.totalRecords || 0) /
                        GRID_CONSTANTS.DEFAULT_PAGE_SIZE
                    ),
            };
        };
    }, [
        debouncedSearch,
        selectedBusinessUnit,
        sortModel,
        followUpDateRange,
    ]);

    // Two separate virtual scroll hooks – one per tab; both stay mounted, visibility toggled by tab
    const {
        data: agentsAll,
        totalRecords: totalRecordsAll,
        isLoading: isLoadingAll,
        isLoadingMore: _isLoadingMoreAll,
        hasMore: hasMoreAll,
        error: errorAll,
        loadMore: loadMoreAll,
        reset: resetAll,
    } = useVirtualInfiniteScroll<CustomerAgent>({
        queryKey: queryKeyAll,
        queryFn: queryFnAll,
    });

    const {
        data: agentsFollowUp,
        totalRecords: totalRecordsFollowUp,
        isLoading: isLoadingFollowUp,
        isLoadingMore: _isLoadingMoreFollowUp,
        hasMore: hasMoreFollowUp,
        error: errorFollowUp,
        loadMore: loadMoreFollowUp,
        reset: resetFollowUp,
    } = useVirtualInfiniteScroll<CustomerAgent>({
        queryKey: queryKeyFollowUp,
        queryFn: queryFnFollowUp,
    });

    // Current tab's data for export and early return (loading/error) when only one grid is visible
    const agents = effectiveActiveTab === FOLLOW_UP_TAB ? agentsFollowUp : agentsAll;
    const totalRecords = effectiveActiveTab === FOLLOW_UP_TAB ? totalRecordsFollowUp : totalRecordsAll;
    const isLoading = effectiveActiveTab === FOLLOW_UP_TAB ? isLoadingFollowUp : isLoadingAll;
    const error = effectiveActiveTab === FOLLOW_UP_TAB ? errorFollowUp : errorAll;
    const loadMore = effectiveActiveTab === FOLLOW_UP_TAB ? loadMoreFollowUp : loadMoreAll;
    const hasMore = effectiveActiveTab === FOLLOW_UP_TAB ? hasMoreFollowUp : hasMoreAll;

    const { data: businessUnits } = useQuery({
        queryKey: ["businessUnits"],
        queryFn: async () => {
            const response = await apiFetch("/api/entities/business-units");
            if (!response.ok) throw new Error("Failed to fetch business units");
            return response.json();
        },
        refetchOnWindowFocus: false,
    });

    const { data: statsData, isLoading: statsLoading } = useQuery<{
        stats: any;
    }>({
        queryKey: [
            "disputeWithAgentsStats",
            {
                search: debouncedSearch,
                outcome: selectedOutcome?.value || "",
                businessUnitId: selectedBusinessUnit?.id || "",
            },
        ],
        queryFn: fetchDisputeWithAgentsStats,
        refetchOnWindowFocus: false,
    });

    // Switch to All Customers when Follow-up tab becomes empty
    React.useEffect(() => {
        if (!showFollowUpTab && activeTab === FOLLOW_UP_TAB) {
            setActiveTab(ALL_CUSTOMERS_TAB);
        }
    }, [showFollowUpTab, activeTab]);

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
    }, [activeTab]);

    // Reset to page 1 when search or filter changes (but not for tab changes)
    // Tab changes are handled automatically by the query key change
    React.useEffect(() => {
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;
        const outcomeChanged =
            prevSelectedOutcomeRef.current !== selectedOutcome;
        const clientTypeChanged = prevClientTypeRef.current !== clientType;
        const followUpDateRangeChanged =
            prevFollowUpDateRangeRef.current !== followUpDateRange;

        prevDebouncedSearchRef.current = debouncedSearch;
        prevSelectedOutcomeRef.current = selectedOutcome;
        prevClientTypeRef.current = clientType;
        prevFollowUpDateRangeRef.current = followUpDateRange;

        // Only reset for search/filter changes; tab change does nothing (two grids, show/hide)
        if (
            searchChanged ||
            outcomeChanged ||
            clientTypeChanged ||
            followUpDateRangeChanged
        ) {
            setQueryKeyVersion((prev) => prev + 1);
            try {
                resetAll();
            } catch (_e) {
                // Error handling for reset
            }
            try {
                resetFollowUp();
            } catch (_e) {
                // Error handling for reset
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        debouncedSearch,
        selectedOutcome,
        clientType,
        followUpDateRange,
        // resetAll/resetFollowUp intentionally excluded to prevent infinite loops
    ]);

    const clearFilters = useCallback(() => {
        setSearch("");
        setSelectedOutcome(null);
        setSelectedBusinessUnit(null);
        setFollowUpDateRange("all");
        setSortModel([{ field: "last_call", sort: "asc" }]);
    }, []);

    // Helper function to map agent to row format
    const mapAgentToRow = useCallback(
        (agent: CustomerAgent) => {
            try {
                if (!agent.Customer) {
                    return {
                        id: agent.id,
                        customer_id: null,
                        customer: t("fields.unknown"),
                        customer_number: t("fields.unknown"),
                        amount_overdue: agent?.total_outstanding_amount ?? 0,
                        amount_formatted: `${formatAmountWithoutSymbol(
                            agent?.total_outstanding_amount ?? 0
                        )} ${agent?.currency || ""}`,
                        days_past_due: 0,
                        customer_country: t("fields.unknown"),
                        customer_current_time: t("fields.unknown"),
                        last_call: null,
                        last_call_result: agent.last_call_result,
                        raw: agent, // Include raw agent data for modal access
                    };
                }

                const country =
                    agent.Customer?.Country?.name ?? t("fields.unknown");
                const currentTime =
                    country !== t("fields.unknown")
                        ? getCurrentTimeForCountry(
                            country,
                            undefined,
                            "en-US",
                            true
                        )
                        : t("fields.unknown");
                const timezone =
                    country !== t("fields.unknown")
                        ? getCountryTimezone(country)
                        : "UTC";

                const daysPastDue = agent?.Customer?.oldest_invoice_overdue_date
                    ? moment().diff(
                        moment(agent.Customer.oldest_invoice_overdue_date),
                        "days"
                    )
                    : agent?.period_start_date
                        ? moment().diff(moment(agent.period_start_date), "days")
                        : 0;
                const normalizedDaysPastDue = Math.max(0, daysPastDue);

                const formatLastCall = (lastCall: Date | string | null) => {
                    if (!lastCall) return null;

                    try {
                        return formatDateForDisplay(
                            new Date(lastCall),
                            "datetime",
                            session?.user?.locale,
                            session?.user?.timezone
                        );
                    } catch (_error) {
                        return moment(lastCall).format("DD-MM-YYYY hh:mm A");
                    }
                };

                const formatFollowUpTime = (
                    followUpTime: Date | string | null
                ) => {
                    if (!followUpTime) return null;
                    try {
                        return formatDateForDisplay(
                            new Date(followUpTime),
                            "datetime",
                            session?.user?.locale,
                            session?.user?.timezone
                        );
                    } catch (_error) {
                        return moment(followUpTime).format(
                            "DD-MM-YYYY hh:mm A"
                        );
                    }
                };

                return {
                    id: agent.id,
                    customer_id: agent.Customer?.id || null,
                    customer: agent.Customer.Person
                        ? `${agent.Customer.Person.first_name || ""} ${agent.Customer.Person.last_name || ""}`.trim() ||
                        t("fields.unknown")
                        : agent.Customer.Company?.name || t("fields.unknown"),
                    customer_number:
                        agent.Customer?.customer_number || t("fields.unknown"),
                    amount_overdue: agent?.total_outstanding_amount ?? 0,
                    amount_formatted: formatCurrencyWithRTLSupport(
                        agent?.total_outstanding_amount ?? 0,
                        agent?.currency || "",
                        session?.user?.locale || "en-US",
                        i18n.language
                    ),
                    days_past_due: normalizedDaysPastDue,
                    customer_country: country,
                    customer_current_time:
                        country !== t("fields.unknown")
                            ? `${currentTime} (${timezone})`
                            : t("fields.unknown"),
                    last_call: formatLastCall(agent.last_call),
                    last_call_result: agent.last_call_result,
                    follow_up_time: formatFollowUpTime(agent.follow_up_time),
                    raw: agent, // Include raw agent data for modal access
                };
            } catch (_error) {
                return {
                    id: agent.id,
                    customer_id: null,
                    customer: t("fields.agent_unknown"),
                    customer_number: t("fields.agent_unknown"),
                    amount_overdue: 0,
                    amount_formatted: "0 ",
                    days_past_due: 0,
                    customer_country: t("fields.agent_unknown"),
                    customer_current_time: t("fields.agent_unknown"),
                    last_call: null,
                    last_call_result: null,
                    follow_up_time: null,
                    raw: agent, // Include raw agent data for modal access
                };
            }
        },
        [t, session]
    );

    // Export handler for agents
    const handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            let apiUrl: string;
            let exportParams: Record<string, string>;

            if (effectiveActiveTab === ALL_CUSTOMERS_TAB) {
                // All Customers tab - use existing endpoint
                const exportSortField = mapSortFieldToApi(
                    sortModel[0]?.field,
                    false
                );
                exportParams = {
                    search: debouncedSearch,
                    outcome: selectedOutcome?.value || "",
                    // clientType: clientType || "", // clientType is not in baseParams
                    businessUnitId: selectedBusinessUnit?.id || "",
                    sortField: exportSortField,
                    sortDirection: sortModel[0]?.sort || "desc",
                    page: "1",
                    limit: (totalRecords || 10000).toString(), // Get all records
                };
                apiUrl = `/api/system/agents?${new URLSearchParams(
                    exportParams
                )}`;
            } else {
                // Follow-up tab - use follow-up endpoint with mapped sort field
                const exportSortField = mapSortFieldToApi(
                    sortModel[0]?.field,
                    true
                );
                exportParams = {
                    search: debouncedSearch,
                    sortField: exportSortField,
                    sortDirection: sortModel[0]?.sort || "desc",
                    followUpDateRange,
                    page: "1",
                    limit: (totalRecords || 10000).toString(), // Get all records
                };
                apiUrl = `/api/system/agents/follow-up?${new URLSearchParams(
                    exportParams
                )}`;
            }

            // Make API call to fetch all records
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(
                    `API call failed: ${response.status} ${response.statusText}`
                );
            }

            const apiData = await response.json();

            // Handle different response formats
            let rawAgents = [];
            if (Array.isArray(apiData)) {
                rawAgents = apiData;
            } else if (apiData.agents && Array.isArray(apiData.agents)) {
                rawAgents = apiData.agents;
            } else if (apiData.data && Array.isArray(apiData.data)) {
                rawAgents = apiData.data;
            } else {
                throw new Error("Unexpected API response format");
            }

            // Extract currency from response if available (similar to queryFn)
            const globalCurrency = (apiData as any).currency || "";

            const transformedAgents = rawAgents.map((agent: CustomerAgent) => {
                const country =
                    agent.Customer?.Country?.name ?? t("fields.unknown");
                const customerName = agent.Customer?.Person
                    ? `${agent.Customer.Person.first_name} ${agent.Customer.Person.last_name}`
                    : agent.Customer?.Company?.name || t("fields.unknown");

                const customerNumber =
                    agent.Customer?.customer_number || t("fields.unknown");
                const amountOverdue = agent?.total_outstanding_amount ?? 0;
                // Use agent currency if available, otherwise fallback to global currency
                const currency = agent?.currency || globalCurrency || "";

                // Calculate days past due
                const daysPastDue = agent?.Customer?.oldest_invoice_overdue_date
                    ? moment().diff(
                        moment(agent.Customer.oldest_invoice_overdue_date),
                        "days"
                    )
                    : agent?.period_start_date
                        ? moment().diff(moment(agent.period_start_date), "days")
                        : 0;
                const normalizedDaysPastDue = Math.max(0, daysPastDue);

                // Calculate customer current time
                const currentTime =
                    country !== t("fields.unknown")
                        ? getCurrentTimeForCountry(
                            country,
                            undefined,
                            "en-US",
                            true
                        )
                        : t("fields.unknown");
                const timezone =
                    country !== t("fields.unknown")
                        ? getCountryTimezone(country)
                        : "UTC";

                // Format last call date
                const lastCallDate = agent.last_call
                    ? formatDateForDisplay(
                        agent.last_call,
                        "datetime",
                        session?.user?.locale,
                        session?.user?.timezone
                    )
                    : null;

                // Format last call result
                const lastCallResult = agent.last_call_result
                    ? formatLastCallResult(agent.last_call_result)
                    : null;

                // Format follow-up time
                const followUpTime = agent.follow_up_time
                    ? formatDateForDisplay(
                        agent.follow_up_time,
                        "datetime",
                        session?.user?.locale,
                        session?.user?.timezone
                    )
                    : null;

                return {
                    id: agent.id,
                    customer_id: agent.Customer?.id || null,
                    customer: customerName,
                    customer_number: customerNumber,
                    // Use formatCurrencyWithCode for currency splitting in export
                    amount_formatted: formatCurrencyWithCode(
                        amountOverdue,
                        currency
                    ),
                    days_past_due: normalizedDaysPastDue,
                    customer_country: country,
                    customer_current_time:
                        country !== t("fields.unknown")
                            ? `${currentTime} (${timezone})`
                            : t("fields.unknown"),
                    last_call: lastCallDate,
                    last_call_result: lastCallResult,
                    follow_up_time: followUpTime,
                    raw: agent,
                };
            });

            return transformedAgents;
        },
        [
            t,
            session,
            totalRecords,
            debouncedSearch,
            selectedOutcome,
            clientType,
            sortModel,
            effectiveActiveTab,
            followUpDateRange,
        ]
    );

    const rowsAll = useMemo(
        () => agentsAll.map((agent: CustomerAgent) => mapAgentToRow(agent)),
        [agentsAll, mapAgentToRow]
    );
    const rowsFollowUp = useMemo(
        () => agentsFollowUp.map((agent: CustomerAgent) => mapAgentToRow(agent)),
        [agentsFollowUp, mapAgentToRow]
    );

    const getUrgencyColor = useCallback(
        (days: number) => {
            if (days >= 90) return theme.palette.chartPalette.dark;
            if (days >= 60) return theme.palette.chartPalette.main;
            if (days >= 30) return theme.palette.chartPalette.light;
            return theme.palette.chartPalette.main;
        },
        [theme]
    );

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

    // Handle mass update completion
    const handleMassUpdateComplete = useCallback(async () => {
        setSelectedRows([]);
        setQueryKeyVersion((prev) => prev + 1);
        await queryClient.invalidateQueries({ queryKey: ["agents-virtual"] });
        await queryClient.invalidateQueries({ queryKey: ["agents-follow-up-virtual"] });
        resetAll();
        resetFollowUp();
    }, [queryClient, resetAll, resetFollowUp]);

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

    // Handle clear follow-up time
    const handleClearFollowUpTime = useCallback(
        async (id: number) => {
            try {
                const response = await apiFetch(`/api/system/agents/follow-up`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id }),
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(
                        data.error || t("messages.failed_to_update_status")
                    );
                }
                _showToast(
                    t("messages.status_updated_successfully"),
                    "success"
                );
                await queryClient.invalidateQueries({
                    queryKey: ["agents-follow-up-virtual"],
                });
                await queryClient.invalidateQueries({
                    queryKey: ["agentsWithFollowUpCall"],
                });
                setQueryKeyVersion((prev) => prev + 1);
                resetFollowUp();
            } catch (error) {
                _showToast((error as Error).message, "error");
            }
        },
        [t, queryClient, resetFollowUp, _showToast]
    );

    const buildColumns = useCallback(
        (showActionsColumn: boolean): GridColDef[] => [
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
            renderCell: (params: GridRenderCellParams) => (
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
                                    prev.filter((id) => id !== params.row.id)
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
            headerName: t("fields.customer"),
            flex: 1,
            minWidth: 150,
            sortable: true,
            renderCell: (params: GridRenderCellParams) => {
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
                        {params.row.customer_id ? (
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
                                    border: "none",
                                    background: "none",
                                    p: 0,
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
                        ) : (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    textAlign: isRTL ? "right" : "left",
                                    direction: isRTL ? "rtl" : "ltr",
                                }}
                            >
                                {params.value}
                            </Typography>
                        )}
                    </Box>
                );
            },
        },
        {
            field: "customer_number",
            headerName: t("fields.customer_number"),
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
                    <Typography variant="body2">{params.value}</Typography>
                </Box>
            ),
        },
        {
            field: "business_unit",
            headerName: t("fields.business_unit", { ns: "business_unit" }),
            flex: 1,
            minWidth: 120,
            sortable: false,
            valueGetter: (params: any) =>
                params.row.Customer?.BusinessUnit?.name || "-",
            renderCell: (params: GridRenderCellParams) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Typography variant="body2">{params.value}</Typography>
                </Box>
            ),
        },
        {
            field: "amount_formatted",
            headerName: t("fields.amount_overdue", { ns: "agents" }),
            flex: 1,
            minWidth: 120,
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
                        variant="body2"
                        color={
                            params.row.amount_overdue > 10000
                                ? theme.palette.error.main
                                : "inherit"
                        }
                    >
                        {params.value}
                    </Typography>
                </Box>
            ),
        },
        {
            field: "days_past_due",
            headerName: t("fields.days_past_due", { ns: "agents" }),
            flex: 1,
            minWidth: 120,
            sortable: true,
            renderCell: (params: GridRenderCellParams) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Chip
                        label={`${params.value} ${t("fields.days")}`}
                        size="small"
                        sx={{
                            backgroundColor: getUrgencyColor(params.value),
                            color: theme.palette.common.white,
                            fontWeight: theme.typography.fontWeightMedium,
                        }}
                    />
                </Box>
            ),
        },
        {
            field: "customer_country",
            headerName: t("fields.customer_country"),
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
                    <Typography variant="body2">{params.value}</Typography>
                </Box>
            ),
        },
        {
            field: "customer_current_time",
            headerName: t("fields.customer_current_time"),
            flex: 1,
            minWidth: 150,
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
                    <Typography variant="body2">{params.value}</Typography>
                </Box>
            ),
        },
        {
            field: "last_call",
            headerName: t("fields.last_call"),
            flex: 1,
            minWidth: 120,
            sortable: true,
            hideable: true,
            valueGetter: (params: any) => {
                // Return raw date for sorting, null if no last call
                return params.row.raw?.last_call || null;
            },
            renderCell: (params: GridRenderCellParams) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Typography variant="body2">
                        {params.row.last_call || ""}
                    </Typography>
                </Box>
            ),
        },
        {
            field: "last_call_result",
            headerName: t("fields.last_call_result"),
            flex: 1,
            minWidth: 120,
            renderCell: (params: GridRenderCellParams) => {
                // Translate in real-time from database value
                const formattedResult = formatLastCallResult(
                    params.row.last_call_result
                );
                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography variant="body2">
                            {formattedResult || "-"}
                        </Typography>
                    </Box>
                );
            },
        },
        {
            field: "follow_up_time",
            headerName: t("fields.log_activity_follow_up_time", {
                ns: "activities",
            }),
            flex: 1,
            minWidth: 150,
            hideable: true,
            renderCell: (params: GridRenderCellParams) => {
                if (!params.value) {
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <Typography variant="body2">-</Typography>
                        </Box>
                    );
                }

                // params.value is a formatted string, but we need the raw date for moment
                // Get the raw date from the row data
                const rawFollowUpTime = params.row.raw?.follow_up_time;
                if (!rawFollowUpTime) {
                    // Fallback: try to parse the formatted string, but this is not ideal
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <Typography variant="body2">
                                {params.value}
                            </Typography>
                        </Box>
                    );
                }

                const followUpTime = moment(rawFollowUpTime);
                const now = moment();
                const isPastDue = followUpTime.isBefore(now, "day");
                const isToday = followUpTime.isSame(now, "day");
                const isUpcoming =
                    followUpTime.isAfter(now, "day") &&
                    followUpTime.isBefore(now.clone().add(3, "days"), "day");

                let color = "text.primary";
                let fontWeight = 500;

                if (isPastDue) {
                    color = "#d32f2f"; // Error red
                    fontWeight = 600;
                } else if (isToday) {
                    color = "#ed6c02"; // Warning orange
                    fontWeight = 600;
                } else if (isUpcoming) {
                    color = "#1976d2"; // Info blue
                }

                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                color,
                                fontWeight,
                                fontSize: "0.875rem",
                            }}
                        >
                            {params.value}
                        </Typography>
                    </Box>
                );
            },
        },
        {
            field: "actions",
            headerName: t("actions.actions", { ns: "common" }),
            flex: 0.5,
            minWidth: 100,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            resizable: false,
            renderCell: (params: GridRenderCellParams) => {
                if (!showActionsColumn) return null;
                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                        }}
                    >
                        <Tooltip title={t("fields.clear_follow_up_time")}>
                            <IconButton
                                size="small"
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    handleClearFollowUpTime(params.row?.id);
                                }}
                                color="primary"
                                sx={{
                                    "&:hover": {
                                        backgroundColor: alpha(
                                            theme.palette.primary.main,
                                            0.08
                                        ),
                                    },
                                }}
                            >
                                <RemoveCircleOutlineIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                );
            },
        },
    ],
        [
            t,
            theme,
            router,
            i18n.language,
            selectedRows,
            getUrgencyColor,
            formatLastCallResult,
            handleClearFollowUpTime,
        ]
    );

    const columnsForAll = useMemo(
        () => buildColumns(false),
        [buildColumns]
    );
    const columnsForFollowUp = useMemo(
        () => buildColumns(true),
        [buildColumns]
    );

    const hasActiveFilters =
        !!debouncedSearch ||
        selectedOutcome ||
        selectedBusinessUnit ||
        (effectiveActiveTab === FOLLOW_UP_TAB && followUpDateRange !== "all");

    // Column visibility: All tab (no follow_up_time or actions), Follow-up tab (show both when breakpoint allows)
    const columnVisibilityModelAll = useMemo(
        () => ({
            checkbox: true,
            customer: windowWidth >= BREAKPOINTS.MOBILE,
            customer_number: windowWidth >= BREAKPOINTS.MOBILE,
            amount_formatted: windowWidth >= BREAKPOINTS.TABLET,
            days_past_due: windowWidth >= BREAKPOINTS.TABLET,
            customer_country: windowWidth >= BREAKPOINTS.DESKTOP,
            customer_current_time: windowWidth >= BREAKPOINTS.DESKTOP,
            last_call: windowWidth >= BREAKPOINTS.TABLET,
            last_call_result: windowWidth >= BREAKPOINTS.TABLET,
            follow_up_time: false,
            actions: false,
        }),
        [windowWidth]
    );
    const columnVisibilityModelFollowUp = useMemo(
        () => ({
            checkbox: true,
            customer: windowWidth >= BREAKPOINTS.MOBILE,
            customer_number: windowWidth >= BREAKPOINTS.MOBILE,
            amount_formatted: windowWidth >= BREAKPOINTS.TABLET,
            days_past_due: windowWidth >= BREAKPOINTS.TABLET,
            customer_country: windowWidth >= BREAKPOINTS.DESKTOP,
            customer_current_time: windowWidth >= BREAKPOINTS.DESKTOP,
            last_call: windowWidth >= BREAKPOINTS.TABLET,
            last_call_result: windowWidth >= BREAKPOINTS.TABLET,
            follow_up_time: windowWidth >= BREAKPOINTS.TABLET,
            actions: windowWidth >= BREAKPOINTS.MOBILE,
        }),
        [windowWidth]
    );

    const searchPlaceholder = useMemo(
        () => t("fields.search_placeholder", { ns: "common" }),
        [t]
    );

    const StatusFilterComponent = useMemo(() => {
        const currentOutcomeValue =
            outcomeSelectOptions.find(
                (option) => option.value === selectedOutcome?.value
            ) || null;

        const followUpDateRangeOptions = [
            {
                value: "today" as const,
                label: t("fields.follow_up_date_range_today"),
            },
            {
                value: "this_week" as const,
                label: t("fields.follow_up_date_range_this_week"),
            },
            {
                value: "next_week" as const,
                label: t("fields.follow_up_date_range_next_week"),
            },
            {
                value: "this_month" as const,
                label: t("fields.follow_up_date_range_this_month"),
            },
            {
                value: "all" as const,
                label: t("fields.follow_up_date_range_all"),
            },
        ];
        const currentFollowUpDateRangeValue =
            effectiveActiveTab === FOLLOW_UP_TAB
                ? followUpDateRangeOptions.find(
                    (opt) => opt.value === followUpDateRange
                ) || followUpDateRangeOptions.find((o) => o.value === "all")!
                : null;

        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: theme.spacing(1),
                    alignItems: { xs: "stretch", sm: "center" },
                    flexWrap: "wrap",
                    width: "100%",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                {/* Only show date range filter for Follow-up tab */}
                {effectiveActiveTab === FOLLOW_UP_TAB && (
                    <ToolbarDropdownFilter
                        value={currentFollowUpDateRangeValue}
                        onChange={(newValue) =>
                            setFollowUpDateRange(
                                newValue?.value ?? "all"
                            )
                        }
                        options={followUpDateRangeOptions}
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, value) =>
                            option.value === value.value
                        }
                        placeholder={t("fields.select_date_range")}
                    />
                )}
                {/* Only show outcome filter for All Customers tab */}
                {effectiveActiveTab === ALL_CUSTOMERS_TAB && (
                    <ToolbarDropdownFilter
                        value={currentOutcomeValue}
                        onChange={(newValue) => setSelectedOutcome(newValue)}
                        options={outcomeSelectOptions}
                        getOptionLabel={(option) => option.label}
                        isOptionEqualToValue={(option, value) =>
                            option.value === value.value
                        }
                        placeholder={t("fields.select_outcome")}
                    />
                )}
                <ToolbarDropdownFilter
                    value={selectedBusinessUnit}
                    onChange={(newValue) => setSelectedBusinessUnit(newValue)}
                    options={businessUnits || []}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) =>
                        option.id === value.id
                    }
                    placeholder={t("fields.select_business_unit", { ns: "business_unit" })}
                    sx={{
                        minWidth: { xs: "100%", sm: theme.spacing(35) },
                        width: { xs: "100%", sm: theme.spacing(35) },
                    }}
                />
                {hasActiveFilters && (
                    <Button
                        size="small"
                        onClick={clearFilters}
                        startIcon={<ClearIcon fontSize="small" />}
                        color="primary"
                        sx={{
                            textTransform: "none",
                            fontWeight: theme.typography.fontWeightMedium,
                            alignSelf: { xs: "flex-start", sm: "center" },
                            "&:hover": {
                                backgroundColor: theme.palette.action.hover,
                            },
                            minWidth: { xs: "100%", sm: "auto" },
                        }}
                    >
                        {t("fields.clear_filters", { ns: "common" })}
                    </Button>
                )}
            </Box>
        );
    }, [
        selectedOutcome,
        outcomeSelectOptions,
        hasActiveFilters,
        t,
        theme,
        clearFilters,
        i18n.language,
        effectiveActiveTab,
        followUpDateRange,
    ]);

    // Bulk action button component
    const BulkActionButtonComponent = useMemo(
        () => (
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
        ),
        [selectedRows.length, i18n.language]
    );

    if (error)
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "400px",
                    flexDirection: "column",
                    gap: 2,
                }}
            >
                <Typography variant="h6" color="error">
                    {t("messages.error_fetching_data")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {error instanceof Error
                        ? error.message
                        : "Unknown error occurred"}
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

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                borderRadius: theme.shape.borderRadius,
            }}
        >
            <PageHeader
                title={title}
                description={description}
            />

            <AgentStats statsData={statsData} statsLoading={statsLoading} />

            {/* Tabs Navigation - only show when Follow-up tab has data */}
            {showFollowUpTab && (
                <Box
                    sx={{
                        width: "100%",
                        bgcolor: "background.paper",
                        borderRadius: theme.shape.borderRadius,
                        mb: 2,
                    }}
                >
                    <Tabs
                        value={activeTab}
                        onChange={(_, newValue) => setActiveTab(newValue)}
                        sx={{
                            borderBottom: 1,
                            borderColor: "divider",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Tab
                            label={t("fields.all_customers")}
                            value={ALL_CUSTOMERS_TAB}
                            sx={{
                                textTransform: "none",
                                fontWeight: theme.typography.fontWeightMedium,
                            }}
                        />
                        <Tab
                            label={`${t("fields.scheduled_follow_ups")} (${followUpCount})`}
                            value={FOLLOW_UP_TAB}
                            sx={{
                                textTransform: "none",
                                fontWeight: theme.typography.fontWeightMedium,
                            }}
                        />
                    </Tabs>
                </Box>
            )}

            {/* Grid – mount only after stats have loaded; show each grid only after its data is loaded (see CustomerList) */}
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
                    {/* All Customers grid – visible when tab is All; show grid only after first page loaded */}
                    <Box
                        sx={{
                            display:
                                effectiveActiveTab === ALL_CUSTOMERS_TAB
                                    ? "block"
                                    : "none",
                        }}
                    >
                        {effectiveActiveTab === ALL_CUSTOMERS_TAB &&
                        isLoadingAll &&
                        agentsAll.length === 0 ? (
                            <Box
                                sx={{
                                    minHeight: 400,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <CircularProgress />
                            </Box>
                        ) : (
                            <EndlessScrollDataGrid
                                key="agents-grid-all"
                            rows={rowsAll}
                            columns={columnsForAll}
                            totalRecords={totalRecordsAll}
                            isLoading={isLoadingAll}
                            onLoadMore={loadMoreAll}
                            hasMore={hasMoreAll}
                            sortModel={sortModel}
                            onSortModelChange={setSortModel}
                            customButtons={StatusFilterComponent}
                            bulkActionButton={BulkActionButtonComponent}
                            searchValue={search}
                            onSearchChange={(value) => setSearch(value)}
                            searchPlaceholder={searchPlaceholder}
                            searchDebounceMs={500}
                            searchDisabled={false}
                            searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                            language={i18n.language}
                            fillViewport={true}
                            resizableColumns={true}
                            columnVisibilityModel={columnVisibilityModelAll}
                            noRowsMessage={t("messages.no_results", { ns: "common" })}
                            noRowsDescription={t("messages.try_adjusting_your_filters")}
                            onExport={handleExport}
                            exportContextInfo={{
                                pageName: "agents",
                                customPrefix: "agents_export",
                            }}
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
                                setSelectedRows(
                                    selectedRowIds.map((id) => Number(id)).filter((id) => !isNaN(id))
                                );
                            }}
                        />
                        )}
                    </Box>
                    {/* Follow-up grid – visible when tab is Follow-up; show grid only after first page loaded */}
                    <Box
                        sx={{
                            display:
                                effectiveActiveTab === FOLLOW_UP_TAB
                                    ? "block"
                                    : "none",
                        }}
                    >
                        {effectiveActiveTab === FOLLOW_UP_TAB &&
                        isLoadingFollowUp &&
                        agentsFollowUp.length === 0 ? (
                            <Box
                                sx={{
                                    minHeight: 400,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <CircularProgress />
                            </Box>
                        ) : (
                            <EndlessScrollDataGrid
                                key="agents-grid-follow-up"
                            rows={rowsFollowUp}
                            columns={columnsForFollowUp}
                            totalRecords={totalRecordsFollowUp}
                            isLoading={isLoadingFollowUp}
                            onLoadMore={loadMoreFollowUp}
                            hasMore={hasMoreFollowUp}
                            sortModel={sortModel}
                            onSortModelChange={setSortModel}
                            customButtons={StatusFilterComponent}
                            bulkActionButton={BulkActionButtonComponent}
                            searchValue={search}
                            onSearchChange={(value) => setSearch(value)}
                            searchPlaceholder={searchPlaceholder}
                            searchDebounceMs={500}
                            searchDisabled={false}
                            searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                            language={i18n.language}
                            fillViewport={true}
                            resizableColumns={true}
                            columnVisibilityModel={columnVisibilityModelFollowUp}
                            noRowsMessage={t("messages.no_results", { ns: "common" })}
                            noRowsDescription={t("messages.try_adjusting_your_filters")}
                            onExport={handleExport}
                            exportContextInfo={{
                                pageName: "agents",
                                customPrefix: "agents_export",
                            }}
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
                                setSelectedRows(
                                    selectedRowIds.map((id) => Number(id)).filter((id) => !isNaN(id))
                                );
                            }}
                        />
                        )}
                    </Box>
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
                selectedRows={(effectiveActiveTab === FOLLOW_UP_TAB ? rowsFollowUp : rowsAll).filter(
                    (row: { id: number }) => selectedRows.includes(row.id)
                )}
                onUpdateComplete={handleMassUpdateComplete}
                currentCategory="Agent"
            />
        </Box>
    );
};

export default AgentList;
