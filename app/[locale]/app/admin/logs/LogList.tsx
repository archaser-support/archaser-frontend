"use client";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import {
    ContentCopy as CopyIcon,
    Report as CriticalIcon,
    BugReport as DebugIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    Warning as WarningIcon,
} from "@mui/icons-material";
import {
    Alert,
    Box,
    Button,
    Chip,
    Fade,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme
} from "@mui/material";
import {
    GridColDef,
    GridRenderCellParams,
    GridSortModel,
} from "@mui/x-data-grid";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import PageHeader from "@/components/PageHeader";
import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import EndlessScrollDataGrid, {
    BREAKPOINTS,
    useVirtualInfiniteScroll,
    useWindowWidth,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { CurrencyColumnsConfig, ExportFormat } from "@/shared/utility/exportToExcel";
import {
    getUserDateFormatOptions,
    getUserDateTimeFormatOptions,
} from "@/utils/datetimeOperations";

// VerticalScrollbar Component (from ActivityTimeline)
interface VerticalScrollbarProps {
    containerRef: React.RefObject<HTMLElement>;
    theme: any;
    data?: any;
    loadedRecordsCount?: number;
    isHovered?: boolean;
}

const VerticalScrollbar: React.FC<VerticalScrollbarProps> = ({
    containerRef,
    theme: _theme,
    data,
    loadedRecordsCount = 0,
    isHovered = false,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [thumbPositionPercentage, setThumbPositionPercentage] = useState(0);
    const [_thumbHeightPercentage, setThumbHeightPercentage] = useState(100);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateScrollProgress = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isScrollable = scrollHeight > clientHeight;
            const containerHeight = clientHeight;

            // Calculate progress based on total records, not just loaded content
            const totalRecords = data?.totalRecords || 0;
            const loadedRecords = loadedRecordsCount || 0;

            let progress = 0;
            if (totalRecords > 0 && isScrollable) {
                const scrollProgress =
                    scrollTop / (scrollHeight - clientHeight);
                const loadedRatio = Math.min(loadedRecords / totalRecords, 1);
                progress = scrollProgress * loadedRatio;
            } else if (isScrollable) {
                progress = scrollTop / (scrollHeight - clientHeight);
            }

            // Calculate thumb position
            const thumbPosition = progress * 100;
            setThumbPositionPercentage(
                Math.max(0, Math.min(100, thumbPosition))
            );

            // Calculate thumb height based on loaded vs total records
            let thumbHeight = 100;
            if (totalRecords > 0) {
                const loadedRecordsRatio = Math.min(
                    loadedRecords / totalRecords,
                    1
                );
                thumbHeight = Math.max(10, loadedRecordsRatio * 100);
            } else if (scrollHeight > 0 && containerHeight > 0) {
                const ratio = containerHeight / scrollHeight;
                thumbHeight = Math.max(20, Math.min(80, ratio * 100));
            }
            setThumbHeightPercentage(thumbHeight);

            // Show scrollbar only when there are enough records AND content is scrollable AND hovering
            const shouldShowScrollbar =
                isScrollable && loadedRecords >= 9 && isHovered;
            setIsVisible(shouldShowScrollbar);
        };

        // Initial update
        const initialTimeout = setTimeout(updateScrollProgress, 100);

        // Add scroll event listener
        container.addEventListener("scroll", updateScrollProgress, {
            passive: true,
        });

        // ResizeObserver for container size changes
        const resizeObserver = new ResizeObserver(() => {
            updateScrollProgress();
        });
        resizeObserver.observe(container);

        // MutationObserver for content changes
        const mutationObserver = new MutationObserver(() => {
            updateScrollProgress();
        });
        mutationObserver.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
        });

        // Periodic update for missed changes
        const intervalId = setInterval(updateScrollProgress, 1000);

        // Cleanup
        return () => {
            clearTimeout(initialTimeout);
            clearInterval(intervalId);
            container.removeEventListener("scroll", updateScrollProgress);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, [containerRef, data?.totalRecords, loadedRecordsCount, isHovered]);

    const handleScrollbarClick = (event: React.MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;

        const rect = event.currentTarget.getBoundingClientRect();
        const clickY = event.clientY - rect.top;
        const percentage = clickY / rect.height;
        const targetScrollTop =
            percentage * (container.scrollHeight - container.clientHeight);

        container.scrollTo({
            top: targetScrollTop,
            behavior: "smooth",
        });
    };

    if (!isVisible) return null;

    return (
        <div
            onClick={handleScrollbarClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleScrollbarClick(e as any);
                }
            }}
            role="button"
            tabIndex={0}
            style={{
                position: "absolute",
                right: "0px",
                top: "0px",
                bottom: "0px",
                width: "4px",
                backgroundColor: "rgba(0, 0, 0, 0.15)",
                borderRadius: "2px",
                overflow: "hidden",
                zIndex: 10,
                cursor: "pointer",
                opacity: isHovered ? 1 : 0,
                transition: "opacity 0.2s ease-in-out",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${Math.min(thumbPositionPercentage, 100)}%`,
                    backgroundColor: "#6B46C1", // theme.palette.primary.main
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "height 0.1s ease-out",
                }}
            />
        </div>
    );
};

interface Log {
    id: string;
    timestamp: string;
    level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
    message: string;
    source: string;
    correlation_id?: string;
    details: any;
}

interface _LogsResponse {
    logs: Log[];
    totalRecords: number;
}

const getLevelIcon = (level: string) => {
    switch (level) {
        case "DEBUG":
            return <DebugIcon fontSize="small" color="success" />;
        case "INFO":
            return <InfoIcon fontSize="small" color="info" />;
        case "WARNING":
            return <WarningIcon fontSize="small" color="warning" />;
        case "ERROR":
            return <ErrorIcon fontSize="small" color="error" />;
        case "CRITICAL":
            return <CriticalIcon fontSize="small" color="error" />;
        default:
            return <InfoIcon fontSize="small" color="inherit" />;
    }
};

export default function LogList() {
    const { t, i18n } = useTranslation(["log", "common"]);
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const windowWidth = useWindowWidth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const _isTablet = useMediaQuery(theme.breakpoints.down("lg"));
    const { showToast } = useToast();

    // Get jobName from URL query parameters (instead of jobId)
    const jobName = searchParams?.get("jobName") || "";

    // Search and filter state
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "timestamp", sort: "desc" },
    ]);

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const prevSelectedLevelRef = useRef(selectedLevel);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const [detailsModal, setDetailsModal] = useState<{
        open: boolean;
        data: any;
        title: string;
    }>({
        open: false,
        data: null,
        title: "",
    });

    // Scrollbar hover state
    const [isRawDataHovered, setIsRawDataHovered] = useState(false);
    const [isDefaultJsonHovered, setIsDefaultJsonHovered] = useState(false);

    // Refs for scrollbar containers
    const rawDataContainerRef = useRef<HTMLDivElement>(null);
    const defaultJsonContainerRef = useRef<HTMLDivElement>(null);

    // Create query key
    const queryKey = useMemo(
        () => [
            "logs-virtual",
            {
                search: debouncedSearch,
                level: selectedLevel,
                sortField: sortModel[0]?.field,
                sortDirection: sortModel[0]?.sort,
                jobName: jobName,
            },
        ],
        [
            debouncedSearch,
            selectedLevel,
            sortModel[0]?.field,
            sortModel[0]?.sort,
            jobName,
        ]
    );

    // Use virtual infinite scroll hook
    const {
        data: logs,
        totalRecords,
        isLoading,
        isLoadingMore: _isLoadingMore,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll<Log>({
        queryKey,
        queryFn: async (page: number = 1) => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "20",
            });

            if (debouncedSearch) {
                params.append("search", debouncedSearch);
            }

            if (jobName) {
                params.append("jobName", jobName);
            }

            if (sortModel[0]?.field) {
                params.append("sortField", sortModel[0].field);
                params.append("sortDirection", sortModel[0].sort || "desc");
            }

            if (selectedLevel) {
                params.append("level", selectedLevel);
            }

            const url = `/api/admin/logs?${params.toString()}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("Failed to fetch logs");
            }

            const data = await response.json();

            return {
                data: data.logs || [],
                totalRecords: data.totalRecords || 0,
                hasMore:
                    (data.logs?.length || 0) > 0 &&
                    page < Math.ceil((data.totalRecords || 0) / 20),
            };
        },
        pageSize: 20,
    });

    // Reset when search/filter changes (but not for sort changes)
    React.useEffect(() => {
        // Only reset if the values actually changed
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;
        const levelChanged = prevSelectedLevelRef.current !== selectedLevel;

        if (searchChanged || levelChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            prevSelectedLevelRef.current = selectedLevel;
            reset();
        }
    }, [debouncedSearch, selectedLevel, reset]);

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

    // Define log level options with icons
    const levelOptions = [
        {
            value: "DEBUG",
            label: t("fields.levels_debug").toUpperCase(),
            icon: <DebugIcon fontSize="small" color="success" />,
        },
        {
            value: "INFO",
            label: t("fields.levels_info").toUpperCase(),
            icon: <InfoIcon fontSize="small" color="info" />,
        },
        {
            value: "WARNING",
            label: t("fields.levels_warning").toUpperCase(),
            icon: <WarningIcon fontSize="small" color="warning" />,
        },
        {
            value: "ERROR",
            label: t("fields.levels_error").toUpperCase(),
            icon: <ErrorIcon fontSize="small" color="error" />,
        },
        {
            value: "CRITICAL",
            label: t("fields.levels_critical").toUpperCase(),
            icon: <CriticalIcon fontSize="small" color="error" />,
        },
    ];

    // Format timestamp according to user's locale and language
    const formatTimestamp = useCallback(
        (timestamp: string) => {
            try {
                if (isMobile) {
                    const formatOptions = getUserDateFormatOptions(session);
                    return new Date(timestamp).toLocaleDateString(
                        session?.user?.locale || "en-US",
                        formatOptions
                    );
                } else {
                    const formatOptions = getUserDateTimeFormatOptions(session);
                    return new Date(timestamp).toLocaleString(
                        session?.user?.locale || "en-US",
                        formatOptions
                    );
                }
            } catch (_error) {
                // Fallback to default locale if user locale is invalid
                return isMobile
                    ? new Date(timestamp).toLocaleDateString()
                    : new Date(timestamp).toLocaleString();
            }
        },
        [isMobile, session]
    );

    // Data transformation
    const mapLogToRow = useCallback(
        (log: Log) => ({
            id: log.id,
            timestamp: log.timestamp,
            level: log.level,
            message: log.message,
            source: log.source,
            correlation_id: log.correlation_id || "",
            details: log.details,
            raw: log,
        }),
        []
    );

    // Export handler for logs
    const handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            try {
                // Use the existing logs data instead of making a new API call
                const rawLogs = logs || [];

                const transformedLogs = rawLogs.map((log: Log) => {
                    // Format timestamp
                    const formattedTimestamp = log.timestamp
                        ? new Date(log.timestamp).toLocaleString()
                        : "";

                    return {
                        id: log.id,
                        timestamp: formattedTimestamp,
                        level: log.level,
                        message: log.message,
                        source: log.source,
                        correlation_id: log.correlation_id || "",
                        details: log.details
                            ? JSON.stringify(log.details, null, 2)
                            : "",
                        raw: log,
                    };
                });

                return transformedLogs;
            } catch (_error) {
                console.error("Export failed:", _error);
                throw _error;
            }
        },
        [logs]
    );

    // Transform data to rows
    const rows = useMemo(() => {
        return logs.map(mapLogToRow);
    }, [logs, mapLogToRow]);

    // Copy log details to clipboard
    const handleCopyDetails = async () => {
        try {
            const detailsText = detailsModal.data
                ? JSON.stringify(detailsModal.data, null, 2)
                : "";

            await navigator.clipboard.writeText(detailsText);
            showToast(t("messages.copy_success"), "success");
        } catch (_error) {
            showToast(t("messages.copy_failed"), "error");
        }
    };

    const columns: GridColDef[] = [
        {
            field: "timestamp",
            headerName: t("fields.timestamp"),
            flex: 1,
            minWidth: isMobile ? 120 : 150,
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
                        variant="body2"
                        sx={{ fontSize: isMobile ? "0.75rem" : "0.875rem" }}
                    >
                        {formatTimestamp(params.row.timestamp)}
                    </Typography>
                </Box>
            ),
        },
        {
            field: "level",
            headerName: t("fields.level"),
            flex: 0.5,
            minWidth: isMobile ? 45 : 50,
            sortable: true,
            hideable: true,
            renderCell: (params: GridRenderCellParams) => (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        width: "100%",
                    }}
                >
                    <Tooltip title={params.row.level} arrow>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {getLevelIcon(params.row.level)}
                        </Box>
                    </Tooltip>
                </Box>
            ),
        },
        {
            field: "source",
            headerName: t("fields.source"),
            flex: 1,
            minWidth: isMobile ? 160 : 200,
            sortable: true,
            hideable: true,
            renderCell: (params: GridRenderCellParams) => (
                <Tooltip
                    title={params.row.source}
                    arrow
                    placement="bottom-start"
                    disableHoverListener={
                        !params.row.source || params.row.source.length <= 15
                    }
                >
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
                                fontSize: isMobile ? "0.75rem" : "0.875rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                width: "100%",
                            }}
                        >
                            {params.row.source}
                        </Typography>
                    </Box>
                </Tooltip>
            ),
        },
        {
            field: "message",
            headerName: t("fields.message"),
            flex: 2,
            minWidth: isMobile ? 200 : 300,
            sortable: false,
            hideable: true,
            renderCell: (params: GridRenderCellParams) => {
                // Check if message contains record count information
                const hasRecordCounts =
                    params.row.message.includes("Processed:") ||
                    params.row.message.includes("Created:") ||
                    params.row.message.includes("Updated:") ||
                    params.row.message.includes("Deleted:");

                // Split message and record counts for better styling
                let messageText = params.row.message;
                let recordCountsText = "";

                if (hasRecordCounts) {
                    const match = messageText.match(/^(.+?)\s*\((.+)\)$/);
                    if (match) {
                        messageText = match[1];
                        recordCountsText = match[2];
                    }
                }

                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            height: "100%",
                            flexDirection: "column",
                            gap: 0.5,
                            cursor: "pointer",
                            "&:hover": {
                                bgcolor: "action.hover",
                                borderRadius: 1,
                            },
                            transition: "all 0.2s ease-in-out",
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setDetailsModal({
                                open: true,
                                data: params.row.details,
                                title: `${t("fields.details_for")} ${params.row.source} - ${formatTimestamp(params.row.timestamp)}`,
                            });
                        }}
                    >
                        <Box sx={{ width: "100%" }}>
                            <Typography
                                variant="body2"
                                sx={{
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "-webkit-box",
                                    WebkitLineClamp: isMobile ? 1 : 2,
                                    WebkitBoxOrient: "vertical",
                                    lineHeight: 1.4,
                                    fontSize: isMobile ? "0.75rem" : "0.875rem",
                                    color: "inherit",
                                    fontWeight: "normal",
                                }}
                            >
                                {messageText}
                            </Typography>
                            {recordCountsText && (
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: theme.palette.primary.main,
                                        fontWeight: 600,
                                        fontSize: isMobile
                                            ? "0.65rem"
                                            : "0.75rem",
                                        display: "block",
                                        mt: 0.25,
                                    }}
                                >
                                    {recordCountsText}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                );
            },
        },
        {
            field: "details",
            headerName: t("fields.details"),
            flex: 0.5,
            minWidth: isMobile ? 60 : 100,
            sortable: false,
            hideable: true,
            renderCell: (params: GridRenderCellParams) => {
                const hasDetails =
                    params.row.details &&
                    Object.keys(params.row.details).length > 0;

                if (!hasDetails) {
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-start",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    fontSize: isMobile ? "0.75rem" : "0.875rem",
                                }}
                            >
                                {isMobile ? "-" : t("fields.no_details")}
                            </Typography>
                        </Box>
                    );
                }

                return (
                    <Box
                        sx={{
                            width: "100%",
                            height: "100%",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            p: 0.5,
                            "&:hover": {
                                bgcolor: "action.hover",
                                borderRadius: 1,
                            },
                            transition: "all 0.2s ease-in-out",
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setDetailsModal({
                                open: true,
                                data: params.row.details,
                                title: `${t("fields.details_for")} ${params.row.source} - ${formatTimestamp(params.row.timestamp)}`,
                            });
                        }}
                    >
                        <Chip
                            label={isMobile ? "..." : t("fields.view")}
                            size="small"
                            variant="outlined"
                            sx={{
                                fontSize: isMobile ? "0.625rem" : "0.75rem",
                                height: isMobile ? 20 : 24,
                            }}
                        />
                    </Box>
                );
            },
        },
    ];

    // Level filter component
    const LevelFilterComponent = () => {
        interface FilterOption {
            label: string;
            value: string;
            icon: React.ReactNode;
        }

        const filterOptions: FilterOption[] = [
            {
                label: t("fields.filters_show_all_logs"),
                value: "",
                icon: <InfoIcon fontSize="small" color="inherit" />,
            },
            ...levelOptions,
        ];

        const currentValue =
            filterOptions.find(
                (option) => option.value === (selectedLevel || "")
            ) || filterOptions[0];

        return (
            <Box
                sx={{
                    display: "flex",
                    gap: theme.spacing(2),
                    alignItems: "center",
                }}
            >
                <ToolbarDropdownFilter<FilterOption>
                    value={currentValue}
                    onChange={(newValue: FilterOption | null) => {
                        setSelectedLevel(
                            newValue?.value === ""
                                ? null
                                : newValue?.value || null
                        );
                    }}
                    options={filterOptions}
                    getOptionLabel={(option: FilterOption) => option.label}
                    isOptionEqualToValue={(
                        option: FilterOption,
                        value: FilterOption
                    ) => option.value === value.value}
                    placeholder={t("fields.select_level")}
                    renderOption={(props, option) => (
                        <Box
                            component="li"
                            {...props}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            {option.icon}
                            {option.label}
                        </Box>
                    )}
                />
            </Box>
        );
    };

    return (
        <Fade in timeout={300}>
            <Box sx={{ width: "100%", maxWidth: "100%" }}>
                <PageHeader
                    title={t("sections.system_logs")}
                    description={t("fields.logs_description")}
                />

                {/* Job Filter Alert */}
                {jobName && (
                    <Alert
                        severity="info"
                        sx={{ mb: 2 }}
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={() => router.push("/app/admin/logs")}
                            >
                                {t("fields.clear_filter")}
                            </Button>
                        }
                    >
                        {t("fields.filtering_for_job", { jobName })}
                    </Alert>
                )}

                {/* Error state */}
                {error && (
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
                            {t("fields.errors_error_fetching_data")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {error instanceof Error
                                ? error.message
                                : "Unknown error occurred"}
                        </Typography>
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={reset}
                        >
                            {t("actions.retry", { ns: "common" })}
                        </Button>
                    </Box>
                )}

                {/* Virtual Grid */}
                <Box
                    ref={tableContainerRef}
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
                        customButtons={<LevelFilterComponent />}
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
                            timestamp: windowWidth >= BREAKPOINTS.MOBILE,
                            level: windowWidth >= BREAKPOINTS.MOBILE,
                            source: windowWidth >= BREAKPOINTS.TABLET,
                            message: windowWidth >= BREAKPOINTS.MOBILE,
                            details: windowWidth >= BREAKPOINTS.DESKTOP,
                        }}
                        noRowsMessage={t("fields.no_logs_found")}
                        noRowsDescription={t("fields.no_logs_description")}
                        onExport={handleExport}
                        exportContextInfo={{
                            pageName: "logs",
                            customPrefix: "logs_export",
                        }}
                        // Currency columns configuration for export splitting (empty for logs)
                        currencyColumns={{} as CurrencyColumnsConfig}
                    />
                </Box>

                {/* Details Modal */}
                <AppDialog
                    open={detailsModal.open}
                    onClose={() =>
                        setDetailsModal({ open: false, data: null, title: "" })
                    }
                    drag={false}
                    align={false}
                    slide={false}
                    isRTL={i18n.language === "he"}
                    title={
                        <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    mb: 1,
                                }}
                            >
                                <Typography
                                    variant={isMobile ? "h6" : "h4"}
                                    component="h2"
                                    sx={{ fontWeight: 600, color: "inherit" }}
                                >
                                    {t("fields.details_title")}
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                    {detailsModal.data
                                        ? `${Math.round((JSON.stringify(detailsModal.data).length / 1024) * 10) / 10}KB`
                                        : ""}
                                </Typography>
                            </Box>
                            {detailsModal.title && (
                                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                    {detailsModal.title}
                                </Typography>
                            )}
                        </Box>
                    }
                    titleIcon={null}
                    ariaLabelledBy="log-details-modal-title"
                    ariaDescribedBy="log-details-modal-description"
                    maxWidth="lg"
                    fullWidth
                    fullScreen={isMobile}
                    paperSx={{
                        sx: {
                            maxHeight: isMobile ? "100vh" : "90vh",
                            minHeight: isMobile ? "100vh" : "50vh",
                        },
                    }}
                    actions={
                        <>
                            <Button
                                onClick={handleCopyDetails}
                                variant="outlined"
                                size="medium"
                                startIcon={<CopyIcon />}
                                sx={{
                                    textTransform: "none",
                                    fontWeight: 500,
                                }}
                            >
                                {t("fields.copy_details")}
                            </Button>
                            <Button
                                onClick={() =>
                                    setDetailsModal({
                                        open: false,
                                        data: null,
                                        title: "",
                                    })
                                }
                                variant="contained"
                                size="medium"
                            >
                                {t("actions.close", { ns: "common" })}
                            </Button>
                        </>
                    }
                >
                    <Box
                        id="log-details-modal-description"
                        component="div"
                        sx={{
                            flex: 1,
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <Box
                            sx={{
                                p: { xs: 2, md: 3 },
                                flex: 1,
                                overflow: "auto",
                                bgcolor: "background.default",
                                maxHeight: "70vh",
                            }}
                        >
                            {/* Enhanced display for Activity Workflow Manager job summaries */}
                            {detailsModal.data &&
                                detailsModal.data.jobCompleted ? (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                    }}
                                >
                                    {/* Job Summary Header */}
                                    <Box
                                        sx={{
                                            p: 2,
                                            bgcolor:
                                                detailsModal.data.totalErrors >
                                                    0
                                                    ? "error.light"
                                                    : "success.light",
                                            borderRadius: 1,
                                            border: 1,
                                            borderColor:
                                                detailsModal.data.totalErrors >
                                                    0
                                                    ? "error.main"
                                                    : "success.main",
                                        }}
                                    >
                                        <Typography
                                            variant="h6"
                                            sx={{ fontWeight: 600, mb: 1 }}
                                        >
                                            {t("fields.job_summary_title")}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {t(
                                                "fields.job_summary_job_completed"
                                            )}
                                            :{" "}
                                            {new Date(
                                                detailsModal.data.jobCompleted
                                            ).toLocaleString()}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {t(
                                                "fields.job_summary_total_duration"
                                            )}
                                            :{" "}
                                            {Math.round(
                                                detailsModal.data
                                                    .totalDuration / 1000
                                            )}
                                            s
                                        </Typography>
                                    </Box>

                                    {/* Key Metrics */}
                                    <Box
                                        sx={{
                                            p: 2,
                                            bgcolor: "background.paper",
                                            borderRadius: 1,
                                            border: 1,
                                            borderColor: "divider",
                                        }}
                                    >
                                        <Typography
                                            variant="subtitle1"
                                            sx={{ fontWeight: 600, mb: 1 }}
                                        >
                                            {t(
                                                "fields.job_summary_key_metrics"
                                            )}
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns:
                                                    "repeat(auto-fit, minmax(200px, 1fr))",
                                                gap: 1,
                                            }}
                                        >
                                            <Box>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {t(
                                                        "fields.job_summary_total_errors"
                                                    )}
                                                    :
                                                </Typography>
                                                <Typography
                                                    variant="body1"
                                                    sx={{
                                                        fontWeight: 500,
                                                        color:
                                                            detailsModal.data
                                                                .totalErrors > 0
                                                                ? "error.main"
                                                                : "success.main",
                                                    }}
                                                >
                                                    {
                                                        detailsModal.data
                                                            .totalErrors
                                                    }
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {t(
                                                        "fields.job_summary_activities_created"
                                                    )}
                                                    :
                                                </Typography>
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontWeight: 500 }}
                                                >
                                                    {
                                                        detailsModal.data
                                                            .activitiesCreated
                                                    }
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {t(
                                                        "fields.job_summary_activities_completed"
                                                    )}
                                                    :
                                                </Typography>
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontWeight: 500 }}
                                                >
                                                    {
                                                        detailsModal.data
                                                            .activitiesCompleted
                                                    }
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {t(
                                                        "fields.job_summary_collection_periods_updated"
                                                    )}
                                                    :
                                                </Typography>
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontWeight: 500 }}
                                                >
                                                    {
                                                        detailsModal.data
                                                            .collectionPeriodsUpdated
                                                    }
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>

                                    {/* Phase 1 Stats */}
                                    {detailsModal.data.phase1Stats && (
                                        <Box
                                            sx={{
                                                p: 2,
                                                bgcolor: "background.paper",
                                                borderRadius: 1,
                                                border: 1,
                                                borderColor: "divider",
                                            }}
                                        >
                                            <Typography
                                                variant="subtitle1"
                                                sx={{ fontWeight: 600, mb: 1 }}
                                            >
                                                {t(
                                                    "fields.job_summary_phase_1_title"
                                                )}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "repeat(auto-fit, minmax(200px, 1fr))",
                                                    gap: 1,
                                                }}
                                            >
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        {t(
                                                            "fields.job_summary_collection_periods"
                                                        )}
                                                        :
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{ fontWeight: 500 }}
                                                    >
                                                        {
                                                            detailsModal.data
                                                                .phase1Stats
                                                                .totalCollectionPeriods
                                                        }
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        {t(
                                                            "fields.job_summary_activity_sequences_found"
                                                        )}
                                                        :
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{ fontWeight: 500 }}
                                                    >
                                                        {
                                                            detailsModal.data
                                                                .phase1Stats
                                                                .activitySequencesFound
                                                        }
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        {t(
                                                            "fields.job_summary_skipped_existing_activities"
                                                        )}
                                                        :
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{ fontWeight: 500 }}
                                                    >
                                                        {
                                                            detailsModal.data
                                                                .phase1Stats
                                                                .skippedDueToExistingActivities
                                                        }
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        {t(
                                                            "fields.job_summary_duration"
                                                        )}
                                                        :
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{ fontWeight: 500 }}
                                                    >
                                                        {Math.round(
                                                            detailsModal.data
                                                                .phase1Stats
                                                                .duration / 1000
                                                        )}
                                                        s
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    )}

                                    {/* Phase 2 Stats */}
                                    {detailsModal.data.phase2Stats && (
                                        <Box
                                            sx={{
                                                p: 2,
                                                bgcolor: "background.paper",
                                                borderRadius: 1,
                                                border: 1,
                                                borderColor: "divider",
                                            }}
                                        >
                                            <Typography
                                                variant="subtitle1"
                                                sx={{ fontWeight: 600, mb: 1 }}
                                            >
                                                {t(
                                                    "fields.job_summary_phase_2_title"
                                                )}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "repeat(auto-fit, minmax(200px, 1fr))",
                                                    gap: 1,
                                                }}
                                            >
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        {t(
                                                            "fields.job_summary_activities_found"
                                                        )}
                                                        :
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{ fontWeight: 500 }}
                                                    >
                                                        {
                                                            detailsModal.data
                                                                .phase2Stats
                                                                .totalActivitiesFound
                                                        }
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        Activities with
                                                        Contacts:
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{ fontWeight: 500 }}
                                                    >
                                                        {
                                                            detailsModal.data
                                                                .phase2Stats
                                                                .activitiesWithContacts
                                                        }
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        Emails Sent:
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{
                                                            fontWeight: 500,
                                                            color: "success.main",
                                                        }}
                                                    >
                                                        {
                                                            detailsModal.data
                                                                .phase2Stats
                                                                .emailsSent
                                                        }
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        Emails Failed:
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{
                                                            fontWeight: 500,
                                                            color:
                                                                detailsModal
                                                                    .data
                                                                    .phase2Stats
                                                                    .emailsFailed >
                                                                    0
                                                                    ? "error.main"
                                                                    : "text.primary",
                                                        }}
                                                    >
                                                        {
                                                            detailsModal.data
                                                                .phase2Stats
                                                                .emailsFailed
                                                        }
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        SMS Sent:
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{
                                                            fontWeight: 500,
                                                            color: "success.main",
                                                        }}
                                                    >
                                                        {
                                                            detailsModal.data
                                                                .phase2Stats
                                                                .smsSent
                                                        }
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        SMS Failed:
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{
                                                            fontWeight: 500,
                                                            color:
                                                                detailsModal
                                                                    .data
                                                                    .phase2Stats
                                                                    .smsFailed >
                                                                    0
                                                                    ? "error.main"
                                                                    : "text.primary",
                                                        }}
                                                    >
                                                        {
                                                            detailsModal.data
                                                                .phase2Stats
                                                                .smsFailed
                                                        }
                                                    </Typography>
                                                </Box>
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        {t(
                                                            "fields.job_summary_duration"
                                                        )}
                                                        :
                                                    </Typography>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{ fontWeight: 500 }}
                                                    >
                                                        {Math.round(
                                                            detailsModal.data
                                                                .phase2Stats
                                                                .duration / 1000
                                                        )}
                                                        s
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    )}

                                    {/* Error Details */}
                                    {detailsModal.data.errorDetails &&
                                        detailsModal.data.errorDetails.length >
                                        0 && (
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    bgcolor: "error.light",
                                                    borderRadius: 1,
                                                    border: 1,
                                                    borderColor: "error.main",
                                                }}
                                            >
                                                <Typography
                                                    variant="subtitle1"
                                                    sx={{
                                                        fontWeight: 600,
                                                        mb: 1,
                                                        color: "error.dark",
                                                    }}
                                                >
                                                    Error Details
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 1,
                                                    }}
                                                >
                                                    {detailsModal.data.errorDetails.map(
                                                        (
                                                            error: string,
                                                            index: number
                                                        ) => (
                                                            <Box
                                                                key={index}
                                                                sx={{
                                                                    p: 1,
                                                                    bgcolor:
                                                                        "background.paper",
                                                                    borderRadius: 0.5,
                                                                    border: 1,
                                                                    borderColor:
                                                                        "error.main",
                                                                }}
                                                            >
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        fontFamily:
                                                                            "monospace",
                                                                        fontSize:
                                                                            "0.875rem",
                                                                    }}
                                                                >
                                                                    {error}
                                                                </Typography>
                                                            </Box>
                                                        )
                                                    )}
                                                </Box>
                                            </Box>
                                        )}

                                    {/* Raw JSON Data (Collapsible) */}
                                    <Box
                                        sx={{
                                            p: 2,
                                            bgcolor: "background.paper",
                                            borderRadius: 1,
                                            border: 1,
                                            borderColor: "divider",
                                            position: "relative",
                                        }}
                                    >
                                        <Typography
                                            variant="subtitle1"
                                            sx={{ fontWeight: 600, mb: 1 }}
                                        >
                                            Raw Data
                                        </Typography>
                                        <Box
                                            ref={rawDataContainerRef}
                                            onMouseEnter={() =>
                                                setIsRawDataHovered(true)
                                            }
                                            onMouseLeave={() =>
                                                setIsRawDataHovered(false)
                                            }
                                            sx={{
                                                position: "relative",
                                                maxHeight: "300px",
                                                overflowY: "auto",
                                                overflowX: "visible",
                                                scrollbarWidth: "none",
                                                "&::-webkit-scrollbar": {
                                                    display: "none",
                                                },
                                                overscrollBehavior: "contain",
                                                touchAction: "pan-y",
                                                scrollBehavior: "smooth",
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                component="pre"
                                                sx={{
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word",
                                                    fontFamily: "monospace",
                                                    fontSize: {
                                                        xs: "0.75rem",
                                                        md: "0.875rem",
                                                    },
                                                    m: 0,
                                                    lineHeight: 1.6,
                                                    color: "text.primary",
                                                }}
                                            >
                                                {JSON.stringify(
                                                    detailsModal.data,
                                                    null,
                                                    2
                                                )}
                                            </Typography>

                                            {/* Dynamic Vertical Scrollbar for Raw Data */}
                                            <VerticalScrollbar
                                                containerRef={
                                                    rawDataContainerRef
                                                }
                                                theme={theme}
                                                data={{ totalRecords: 1 }}
                                                loadedRecordsCount={1}
                                                isHovered={isRawDataHovered}
                                            />
                                        </Box>
                                    </Box>
                                </Box>
                            ) : (
                                /* Default JSON display for other log types */
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                    }}
                                >
                                    {/* User Information Section */}
                                    {detailsModal.data?.userId && (
                                        <Box
                                            sx={{
                                                p: 2,
                                                bgcolor: "background.paper",
                                                borderRadius: 1,
                                                border: 1,
                                                borderColor: "divider",
                                            }}
                                        >
                                            <Typography
                                                variant="subtitle1"
                                                sx={{
                                                    fontWeight: 600,
                                                    mb: 1.5,
                                                }}
                                            >
                                                User Information
                                            </Typography>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 1,
                                                }}
                                            >
                                                {detailsModal.data.userName && (
                                                    <Box>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            User:
                                                        </Typography>
                                                        <Link
                                                            href={`/app/settings/users/${detailsModal.data.userId}`}
                                                            style={{
                                                                textDecoration:
                                                                    "none",
                                                            }}
                                                        >
                                                            <Typography
                                                                variant="body1"
                                                                sx={{
                                                                    fontWeight: 500,
                                                                    color: "primary.main",
                                                                    "&:hover": {
                                                                        textDecoration:
                                                                            "underline",
                                                                    },
                                                                }}
                                                            >
                                                                {
                                                                    detailsModal
                                                                        .data
                                                                        .userName
                                                                }
                                                            </Typography>
                                                        </Link>
                                                    </Box>
                                                )}
                                                {detailsModal.data
                                                    .accountName && (
                                                        <Box>
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                            >
                                                                Account:
                                                            </Typography>
                                                            <Typography
                                                                variant="body1"
                                                                sx={{
                                                                    fontWeight: 500,
                                                                }}
                                                            >
                                                                {
                                                                    detailsModal
                                                                        .data
                                                                        .accountName
                                                                }
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                {detailsModal.data
                                                    .accountId && (
                                                        <Box>
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                            >
                                                                Account ID:
                                                            </Typography>
                                                            <Typography
                                                                variant="body1"
                                                                sx={{
                                                                    fontWeight: 500,
                                                                }}
                                                            >
                                                                {
                                                                    detailsModal
                                                                        .data
                                                                        .accountId
                                                                }
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                {detailsModal.data
                                                    .totalClients !==
                                                    undefined && (
                                                        <Box>
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                            >
                                                                Total Clients:
                                                            </Typography>
                                                            <Typography
                                                                variant="body1"
                                                                sx={{
                                                                    fontWeight: 500,
                                                                }}
                                                            >
                                                                {
                                                                    detailsModal
                                                                        .data
                                                                        .totalClients
                                                                }
                                                            </Typography>
                                                        </Box>
                                                    )}
                                            </Box>
                                        </Box>
                                    )}

                                    {/* JSON Data */}
                                    <Box
                                        sx={{
                                            p: { xs: 1, md: 2 },
                                            bgcolor: "background.paper",
                                            borderRadius: 1,
                                            border: 1,
                                            borderColor: "divider",
                                            position: "relative",
                                        }}
                                    >
                                        <Box
                                            ref={defaultJsonContainerRef}
                                            onMouseEnter={() =>
                                                setIsDefaultJsonHovered(true)
                                            }
                                            onMouseLeave={() =>
                                                setIsDefaultJsonHovered(false)
                                            }
                                            sx={{
                                                position: "relative",
                                                maxHeight: "400px",
                                                overflowY: "auto",
                                                overflowX: "visible",
                                                scrollbarWidth: "none",
                                                "&::-webkit-scrollbar": {
                                                    display: "none",
                                                },
                                                overscrollBehavior: "contain",
                                                touchAction: "pan-y",
                                                scrollBehavior: "smooth",
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                component="pre"
                                                sx={{
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-word",
                                                    fontFamily: "monospace",
                                                    fontSize: {
                                                        xs: "0.75rem",
                                                        md: "0.875rem",
                                                    },
                                                    m: 0,
                                                    lineHeight: 1.6,
                                                    color: "text.primary",
                                                }}
                                            >
                                                {detailsModal.data
                                                    ? JSON.stringify(
                                                        detailsModal.data,
                                                        null,
                                                        2
                                                    )
                                                    : ""}
                                            </Typography>

                                            {/* Dynamic Vertical Scrollbar for Default JSON */}
                                            <VerticalScrollbar
                                                containerRef={
                                                    defaultJsonContainerRef
                                                }
                                                theme={theme}
                                                data={{ totalRecords: 1 }}
                                                loadedRecordsCount={1}
                                                isHovered={isDefaultJsonHovered}
                                            />
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </AppDialog>
            </Box>
        </Fade>
    );
}
