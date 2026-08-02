"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    MonitorHeart as MonitorHeartIcon,
    Refresh as RefreshIcon,
    Schedule as ScheduleIcon,
    TrendingUp as TrendingUpIcon,
    Upload as UploadIcon,
} from "@mui/icons-material";
import {
    Box,
    Card,
    CardContent,
    Typography,
    CircularProgress,
    IconButton,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Alert,
} from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import React, { Fragment, useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import Seo from "@/shared/layout-components/seo/seo";
import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";

interface SystemHealthData {
    cronJobs: {
        overview: {
            totalJobs: number;
            overdueCount: number;
            runningCount: number;
            notRunIn24hCount: number;
            overallSuccessRate: number;
        };
        jobs: Array<{
            id: number;
            name: string;
            lastRunAt: string | null;
            nextRunAt: string | null;
            lastExecutionDurationSeconds: number | null;
            averageExecutionDurationSeconds: number | null;
            minExecutionDurationSeconds: number | null;
            maxExecutionDurationSeconds: number | null;
            timeoutPeriodSeconds: number;
            successRate30d: number;
            failureRate30d: number;
            timeoutRate30d: number;
            lastSuccessAt: string | null;
            lastFailureAt: string | null;
            lastTimeoutAt: string | null;
            performanceBaselineSeconds: number | null;
            performanceDegradationAlertSentAt: string | null;
            active: boolean;
        }>;
    };
    activities: {
        email: {
            sent1h: number;
            sent6h: number;
            sent24h: number;
            generated1h: number;
            generated6h: number;
            generated24h: number;
            failed1h: number;
            failed6h: number;
            failed24h: number;
            bounced1h: number;
            bounced6h: number;
            bounced24h: number;
        };
        sms: {
            sent1h: number;
            sent6h: number;
            sent24h: number;
            generated1h: number;
            generated6h: number;
            generated24h: number;
            failed1h: number;
            failed6h: number;
            failed24h: number;
        };
        stuck: {
            total: number;
            byReason: Array<{
                reason: string;
                count: number;
            }>;
        };
    };
    imports: {
        overview: {
            total24h: number;
            total7d: number;
            total30d: number;
            pendingCount: number;
            stuckCount: number;
            overallSuccessRate: number;
            avgProcessingTimeSeconds: number | null;
            recordsPerHour: number;
        };
        byType: Array<{
            importType: string;
            count24h: number;
            count7d: number;
            count30d: number;
            totalRecords: number;
            successfulRecords: number;
            failedRecords: number;
            successRate: number;
            avgDurationSeconds: number | null;
            recordsPerHour: number;
        }>;
    };
}

const SystemHealthContainer = () => {
    const { status } = useSession();
    const { t, i18n } = useTranslation(["system_health", "common"]);
    const [refreshCountdown, setRefreshCountdown] = useState(60);
    const cronJobsTableRef = useRef<HTMLDivElement>(null);
    const importsTableRef = useRef<HTMLDivElement>(null);

    const {
        data: healthData,
        isLoading,
        error,
        refetch,
    } = useQuery<SystemHealthData>({
        queryKey: ["systemHealth"],
        queryFn: async () => {
            const response = await apiFetch("/api/system/admin/system-health");
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to fetch system health data"
                );
            }
            const result = await response.json();
            return result.data ?? result;
        },
        refetchInterval: 60000, // Refetch every minute (60 seconds)
        refetchIntervalInBackground: true, // Continue refetching when tab is in background
        refetchOnWindowFocus: true, // Refetch when window regains focus
        refetchOnMount: true, // Refetch when component mounts
        staleTime: 0, // Data is immediately stale, allowing refetch
    });

    // Reset countdown when data is successfully fetched
    useEffect(() => {
        if (healthData) {
            setRefreshCountdown(60);
        }
    }, [healthData]);

    // Countdown timer for refresh
    useEffect(() => {
        if (refreshCountdown <= 0) {
            setRefreshCountdown(60);
            return;
        }

        const timer = setInterval(() => {
            setRefreshCountdown((prev) => {
                if (prev <= 1) {
                    return 60;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [refreshCountdown]);

    // Handle page-wide scrolling to scroll the tables
    useEffect(() => {
        const findScrollableContainer = (
            ref: React.RefObject<HTMLDivElement>
        ): HTMLElement | null => {
            if (!ref.current) return null;

            // The scrollable container is a direct child div with overflow-y: auto
            // Look for divs that have overflow styles
            const allDivs = ref.current.querySelectorAll<HTMLElement>("div");

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

            // Try both table containers
            const cronJobsContainer = findScrollableContainer(cronJobsTableRef);
            const importsContainer = findScrollableContainer(importsTableRef);

            // Check which container is visible and can scroll
            let container: HTMLElement | null = null;
            if (cronJobsContainer) {
                const rect = cronJobsContainer.getBoundingClientRect();
                const isVisible =
                    rect.top < window.innerHeight &&
                    rect.bottom > 0 &&
                    rect.width > 0 &&
                    rect.height > 0;
                if (isVisible) {
                    container = cronJobsContainer;
                }
            }

            if (!container && importsContainer) {
                const rect = importsContainer.getBoundingClientRect();
                const isVisible =
                    rect.top < window.innerHeight &&
                    rect.bottom > 0 &&
                    rect.width > 0 &&
                    rect.height > 0;
                if (isVisible) {
                    container = importsContainer;
                }
            }

            if (!container) return;

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

    // Helper functions (must be defined before early returns for useMemo)
    const formatDuration = (seconds: number | null): string => {
        if (!seconds) return "-";
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        return `${Math.round(seconds / 3600)}h`;
    };

    const formatRelativeTime = (
        dateString: string | null,
        isFuture: boolean = false
    ): string => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = Math.abs(now.getTime() - date.getTime());
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        const isInPast = date.getTime() < now.getTime();

        if (diffMins < 1) {
            if (isInPast) {
                return t("common:messages.just_now_full", "Just now");
            } else {
                return t("common:messages.in_a_moment", "In a moment");
            }
        }

        if (isInPast) {
            if (diffMins < 60)
                return t(
                    "common:messages.minutes_ago_full",
                    "{{count}} minutes ago",
                    {
                        count: diffMins,
                    }
                );
            if (diffHours < 24)
                return t(
                    "common:messages.hours_ago_full",
                    "{{count}} hours ago",
                    {
                        count: diffHours,
                    }
                );
            return t("common:messages.days_ago_full", "{{count}} days ago", {
                count: diffDays,
            });
        } else {
            if (diffMins < 60)
                return t("common:messages.in_minutes", "in {{count}} minutes", {
                    count: diffMins,
                });
            if (diffHours < 24)
                return t("common:messages.in_hours", "in {{count}} hours", {
                    count: diffHours,
                });
            return t("common:messages.in_days", "in {{count}} days", {
                count: diffDays,
            });
        }
    };

    // Define columns for cron jobs table (must be at top level for hooks)
    const cronJobColumns: GridColDef[] = useMemo(
        () => [
            {
                field: "name",
                headerName: t("fields.name", "Name"),
                width: 200,
                minWidth: 150,
                renderCell: (params) => {
                    const job =
                        params.row as SystemHealthData["cronJobs"]["jobs"][0];
                    // Explicitly check for true (handle null/undefined as false)
                    const isActive = job.active === true;

                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            {isActive && (
                                <Chip
                                    label={t("values.running", "Running")}
                                    color="primary"
                                    size="small"
                                    sx={{ height: 20, fontSize: "0.65rem" }}
                                />
                            )}
                            <Typography>{params.value}</Typography>
                        </Box>
                    );
                },
            },
            {
                field: "lastRunAt",
                headerName: t("fields.last_run", "Last Run"),
                width: 150,
                minWidth: 120,
                renderCell: (params) => formatRelativeTime(params.value),
            },
            {
                field: "nextRunAt",
                headerName: t("fields.next_run", "Next Run"),
                width: 150,
                minWidth: 120,
                renderCell: (params) => {
                    const job =
                        params.row as SystemHealthData["cronJobs"]["jobs"][0];
                    const now = new Date();
                    const nextRun = job.nextRunAt
                        ? new Date(job.nextRunAt)
                        : null;
                    const isOverdue = nextRun && nextRun < now;
                    const delayMinutes =
                        nextRun && isOverdue
                            ? Math.round(
                                  (now.getTime() - nextRun.getTime()) /
                                      (60 * 1000)
                              )
                            : 0;
                    const isLate = delayMinutes > 3;

                    const text = params.value
                        ? formatRelativeTime(params.value)
                        : "-";

                    // Add tooltip with delay information
                    const tooltipText = isOverdue
                        ? `Overdue by ${delayMinutes} minute${delayMinutes !== 1 ? "s" : ""}. This delay can be caused by: 1) External scheduler not calling frequently enough, 2) Another job currently running, 3) Job queue buildup.`
                        : text;

                    return (
                        <Tooltip title={tooltipText} arrow>
                            <Typography
                                sx={{
                                    color: isLate
                                        ? "error.main"
                                        : isOverdue
                                          ? "warning.main"
                                          : "text.primary",
                                    fontWeight: isLate || isOverdue ? 600 : 400,
                                    cursor: isOverdue ? "help" : "default",
                                }}
                            >
                                {text}
                            </Typography>
                        </Tooltip>
                    );
                },
            },
            {
                field: "lastExecutionDurationSeconds",
                headerName: t("fields.last_run_duration", "Last Run Duration"),
                width: 150,
                minWidth: 120,
                renderCell: (params) =>
                    params.value !== null && params.value !== undefined
                        ? formatDuration(params.value)
                        : "-",
            },
            {
                field: "averageExecutionDurationSeconds",
                headerName: t("fields.avg_duration", "Avg Duration"),
                width: 130,
                minWidth: 100,
                align: "right",
                headerAlign: "right",
                renderCell: (params) =>
                    params.value !== null && params.value !== undefined
                        ? formatDuration(params.value)
                        : "-",
            },
            {
                field: "maxExecutionDurationSeconds",
                headerName: t("fields.max_duration", "Max Duration"),
                width: 130,
                minWidth: 100,
                align: "right",
                headerAlign: "right",
                renderCell: (params) =>
                    params.value !== null && params.value !== undefined
                        ? formatDuration(params.value)
                        : "-",
            },
            {
                field: "failureRate30d",
                headerName: t("fields.failure_rate_30d", "Failure Rate (30d)"),
                width: 150,
                minWidth: 120,
                align: "right",
                headerAlign: "right",
                renderCell: (params) => (
                    <Chip
                        label={`${params.value.toFixed(1)}%`}
                        color={
                            params.value > 10
                                ? "error"
                                : params.value > 5
                                  ? "warning"
                                  : "default"
                        }
                        size="small"
                    />
                ),
            },
            {
                field: "timeoutRate30d",
                headerName: t("fields.timeout_rate_30d", "Timeout Rate (30d)"),
                width: 150,
                minWidth: 120,
                align: "right",
                headerAlign: "right",
                renderCell: (params) => (
                    <Chip
                        label={`${params.value.toFixed(1)}%`}
                        color={
                            params.value > 5
                                ? "error"
                                : params.value > 2
                                  ? "warning"
                                  : "default"
                        }
                        size="small"
                    />
                ),
            },
            {
                field: "lastStatus",
                headerName: t("fields.last_status", "Last Status"),
                width: 150,
                minWidth: 120,
                renderCell: (params) => {
                    const job =
                        params.row as SystemHealthData["cronJobs"]["jobs"][0];
                    return (
                        <Tooltip
                            title={
                                <Box>
                                    {job.lastSuccessAt && (
                                        <Typography
                                            variant="caption"
                                            display="block"
                                        >
                                            {t(
                                                "fields.last_success",
                                                "Last Success"
                                            )}
                                            :{" "}
                                            {formatRelativeTime(
                                                job.lastSuccessAt
                                            )}
                                        </Typography>
                                    )}
                                    {job.lastFailureAt && (
                                        <Typography
                                            variant="caption"
                                            display="block"
                                        >
                                            {t(
                                                "fields.last_failure",
                                                "Last Failure"
                                            )}
                                            :{" "}
                                            {formatRelativeTime(
                                                job.lastFailureAt
                                            )}
                                        </Typography>
                                    )}
                                    {job.lastTimeoutAt && (
                                        <Typography
                                            variant="caption"
                                            display="block"
                                        >
                                            {t(
                                                "fields.last_timeout",
                                                "Last Timeout"
                                            )}
                                            :{" "}
                                            {formatRelativeTime(
                                                job.lastTimeoutAt
                                            )}
                                        </Typography>
                                    )}
                                    {!job.lastSuccessAt &&
                                        !job.lastFailureAt &&
                                        !job.lastTimeoutAt && (
                                            <Typography variant="caption">
                                                {t(
                                                    "fields.no_status_history",
                                                    "No status history"
                                                )}
                                            </Typography>
                                        )}
                                </Box>
                            }
                        >
                            <Chip
                                label={
                                    job.lastFailureAt
                                        ? t("values.failed", "Failed")
                                        : job.lastTimeoutAt
                                          ? t("values.timeout", "Timeout")
                                          : job.lastSuccessAt
                                            ? t("values.success", "Success")
                                            : "-"
                                }
                                color={
                                    job.lastFailureAt
                                        ? "error"
                                        : job.lastTimeoutAt
                                          ? "warning"
                                          : job.lastSuccessAt
                                            ? "success"
                                            : "default"
                                }
                                size="small"
                            />
                        </Tooltip>
                    );
                },
            },
        ],
        [t, formatDuration, formatRelativeTime]
    );

    // Define columns for imports by type table (must be at top level for hooks)
    const importColumns: GridColDef[] = useMemo(
        () => [
            {
                field: "importType",
                headerName: t("fields.import_type", "Type"),
                width: 150,
                minWidth: 120,
            },
            {
                field: "count24h",
                headerName: t("fields.count_24h", "24h"),
                width: 100,
                minWidth: 80,
                align: "right",
                headerAlign: "right",
                renderCell: (params) => params.value?.toLocaleString() || 0,
            },
            {
                field: "count7d",
                headerName: t("fields.count_7d", "7d"),
                width: 100,
                minWidth: 80,
                align: "right",
                headerAlign: "right",
                renderCell: (params) => params.value?.toLocaleString() || 0,
            },
            {
                field: "count30d",
                headerName: t("fields.count_30d", "30d"),
                width: 100,
                minWidth: 80,
                align: "right",
                headerAlign: "right",
                renderCell: (params) => params.value?.toLocaleString() || 0,
            },
            {
                field: "totalRecords",
                headerName: t("fields.total_records", "Total Records"),
                width: 130,
                minWidth: 100,
                align: "right",
                headerAlign: "right",
                renderCell: (params) => params.value?.toLocaleString() || 0,
            },
            {
                field: "successRate",
                headerName: t("fields.success_rate", "Success Rate"),
                width: 130,
                minWidth: 100,
                align: "right",
                headerAlign: "right",
                renderCell: (params) => (
                    <Chip
                        label={`${params.value.toFixed(1)}%`}
                        color={
                            params.value >= 90
                                ? "success"
                                : params.value >= 70
                                  ? "warning"
                                  : "error"
                        }
                        size="small"
                    />
                ),
            },
            {
                field: "pending",
                headerName: t("common:pending", "Pending"),
                width: 120,
                minWidth: 100,
                align: "right",
                headerAlign: "right",
                renderCell: (params) =>
                    params.value !== undefined ? params.value : "-",
            },
            {
                field: "recordsPerHour",
                headerName: t("common:records_per_hour", "Records/Hour"),
                width: 130,
                minWidth: 100,
                align: "right",
                headerAlign: "right",
                renderCell: (params) => Math.round(params.value || 0),
            },
            {
                field: "avgDurationSeconds",
                headerName: t("common:avg_duration", "Avg Duration"),
                width: 130,
                minWidth: 100,
                align: "right",
                headerAlign: "right",
                renderCell: (params) =>
                    params.value ? formatDuration(params.value) : "-",
            },
        ],
        [t, formatDuration]
    );

    // Show loading state when session is loading
    if (status === "loading" || isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: { xs: "300px", sm: "400px" },
                    px: { xs: 2, sm: 3 },
                }}
            >
                <CircularProgress size={48} />
            </Box>
        );
    }

    if (status === "unauthenticated") {
        return null;
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">
                    {t(
                        "common:messages.failed_to_load",
                        "Failed to load system health data"
                    )}
                </Alert>
            </Box>
        );
    }

    return (
        <Fragment>
            <Seo title={t("sections.system_health_title", "System Health")} />

            {/* Header */}
            <PageHeader
                title={t("sections.system_health_title", "System Health")}
                description={t(
                    "sections.system_health_description",
                    "Monitor system performance, cron jobs, activities, and imports"
                )}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                    }}
                >
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 600,
                            color: "primary.main",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {t(
                            "messages.refreshing_in",
                            "Refreshing in {{count}}s",
                            {
                                count: refreshCountdown,
                            }
                        )}
                    </Typography>
                    <Tooltip title={t("actions.refresh", "Refresh")}>
                        <IconButton
                            onClick={() => {
                                refetch();
                                setRefreshCountdown(60);
                            }}
                            sx={{
                                color: "text.primary",
                                "&:hover": {
                                    backgroundColor: "action.hover",
                                },
                            }}
                        >
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </PageHeader>

            {healthData && (
                <Box sx={{ px: { xs: 1, sm: 0 } }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                md: "1fr 1fr 2fr",
                            },
                            gap: 3,
                        }}
                    >
                        {/* Email Activities Card */}
                        <Box>
                            <Card>
                                <CardContent>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            mb: 2,
                                        }}
                                    >
                                        <TrendingUpIcon color="primary" />
                                        <Typography variant="h6">
                                            {t("fields.email", "Email")}
                                        </Typography>
                                    </Box>
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>
                                                        {t(
                                                            "fields.metric",
                                                            "Metric"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {t(
                                                            "fields.last_hour",
                                                            "1h"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {t(
                                                            "fields.last_6_hours",
                                                            "6h"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {t(
                                                            "fields.last_24_hours",
                                                            "24h"
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {/* Email - Sent */}
                                                <TableRow>
                                                    <TableCell>
                                                        {t(
                                                            "fields.sent",
                                                            "Sent"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email.sent1h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email.sent6h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email.sent24h
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                                {/* Email - Generated */}
                                                <TableRow>
                                                    <TableCell>
                                                        {t(
                                                            "fields.generated",
                                                            "Generated"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email
                                                                .generated1h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email
                                                                .generated6h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email
                                                                .generated24h
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                                {/* Email - Failed */}
                                                <TableRow>
                                                    <TableCell>
                                                        {t(
                                                            "fields.failed",
                                                            "Failed"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email.failed1h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email.failed6h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email.failed24h
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                                {/* Email - Bounced */}
                                                <TableRow>
                                                    <TableCell>
                                                        {t(
                                                            "fields.bounced",
                                                            "Bounced"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email.bounced1h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email.bounced6h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities
                                                                .email
                                                                .bounced24h
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        </Box>

                        {/* SMS Activities Card */}
                        <Box>
                            <Card>
                                <CardContent>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            mb: 2,
                                        }}
                                    >
                                        <TrendingUpIcon color="primary" />
                                        <Typography variant="h6">
                                            {t("fields.sms", "SMS")}
                                        </Typography>
                                    </Box>
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>
                                                        {t(
                                                            "fields.metric",
                                                            "Metric"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {t(
                                                            "fields.last_hour",
                                                            "1h"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {t(
                                                            "fields.last_6_hours",
                                                            "6h"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {t(
                                                            "fields.last_24_hours",
                                                            "24h"
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {/* SMS - Sent */}
                                                <TableRow>
                                                    <TableCell>
                                                        {t(
                                                            "fields.sent",
                                                            "Sent"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities.sms
                                                                .sent1h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities.sms
                                                                .sent6h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities.sms
                                                                .sent24h
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                                {/* SMS - Generated */}
                                                <TableRow>
                                                    <TableCell>
                                                        {t(
                                                            "fields.generated",
                                                            "Generated"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities.sms
                                                                .generated1h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities.sms
                                                                .generated6h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities.sms
                                                                .generated24h
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                                {/* SMS - Failed */}
                                                <TableRow>
                                                    <TableCell>
                                                        {t(
                                                            "fields.failed",
                                                            "Failed"
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities.sms
                                                                .failed1h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities.sms
                                                                .failed6h
                                                        }
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {
                                                            healthData
                                                                .activities.sms
                                                                .failed24h
                                                        }
                                                    </TableCell>
                                                </TableRow>
                                                {/* Stuck Activities */}
                                                <TableRow>
                                                    <TableCell>
                                                        {t(
                                                            "fields.stuck_activities",
                                                            "Stuck Activities"
                                                        )}
                                                    </TableCell>
                                                    <TableCell
                                                        colSpan={3}
                                                        align="right"
                                                    >
                                                        <Typography
                                                            color={
                                                                healthData
                                                                    .activities
                                                                    .stuck
                                                                    .total > 0
                                                                    ? "warning.main"
                                                                    : "text.primary"
                                                            }
                                                        >
                                                            {
                                                                healthData
                                                                    .activities
                                                                    .stuck.total
                                                            }
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                                {healthData.activities.stuck
                                                    .byReason.length > 0 &&
                                                    healthData.activities.stuck.byReason.map(
                                                        (
                                                            item: {
                                                                reason: string;
                                                                count: number;
                                                            },
                                                            idx: number
                                                        ) => (
                                                            <TableRow key={idx}>
                                                                <TableCell
                                                                    sx={{
                                                                        pl: 4,
                                                                    }}
                                                                >
                                                                    {
                                                                        item.reason
                                                                    }
                                                                </TableCell>
                                                                <TableCell
                                                                    align="right"
                                                                    colSpan={2}
                                                                >
                                                                    {item.count}
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    )}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        </Box>

                        {/* Cron Jobs Table */}
                        <Box sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}>
                            <Card>
                                <CardContent ref={cronJobsTableRef}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            mb: 2,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <ScheduleIcon color="primary" />
                                            <Typography variant="h6">
                                                {t(
                                                    "sections.cron_jobs",
                                                    "Cron Jobs"
                                                )}
                                            </Typography>
                                        </Box>
                                        {healthData.cronJobs.overview
                                            .notRunIn24hCount > 0 && (
                                            <Chip
                                                label={`${t(
                                                    "fields.not_run_24h",
                                                    "Not Run 24h"
                                                )}: ${
                                                    healthData.cronJobs.overview
                                                        .notRunIn24hCount
                                                }`}
                                                color="error"
                                                size="small"
                                            />
                                        )}
                                    </Box>
                                    {healthData &&
                                        (() => {
                                            // Prepare rows with status calculation
                                            const rows =
                                                healthData.cronJobs.jobs.map(
                                                    (job) => {
                                                        return {
                                                            ...job,
                                                            lastStatus:
                                                                job.lastFailureAt
                                                                    ? "failed"
                                                                    : job.lastTimeoutAt
                                                                      ? "timeout"
                                                                      : job.lastSuccessAt
                                                                        ? "success"
                                                                        : null,
                                                        };
                                                    }
                                                );

                                            // Calculate height to show all rows (no scrolling)
                                            const ITEM_HEIGHT = 48; // Height of each row
                                            const HEADER_HEIGHT = 48; // Height of header
                                            const totalRowsHeight =
                                                rows.length * ITEM_HEIGHT;
                                            const minHeight = 200; // Minimum height
                                            const calculatedHeight = Math.max(
                                                minHeight,
                                                HEADER_HEIGHT + totalRowsHeight
                                            );

                                            return (
                                                <EndlessScrollDataGrid
                                                    rows={rows}
                                                    columns={cronJobColumns}
                                                    totalRecords={rows.length}
                                                    isLoading={false}
                                                    onLoadMore={() => {}}
                                                    hasMore={false}
                                                    language={
                                                        i18n.language || "en"
                                                    }
                                                    height={{
                                                        xs: calculatedHeight,
                                                        sm: calculatedHeight,
                                                        md: calculatedHeight,
                                                    }}
                                                    hideToolbar={true}
                                                    resizableColumns={true}
                                                    noRowsMessage={t(
                                                        "common:messages.no_results",
                                                        "No cron jobs found"
                                                    )}
                                                    noRowsDescription={t(
                                                        "common:messages.no_results_description",
                                                        "There are no cron jobs configured in the system"
                                                    )}
                                                />
                                            );
                                        })()}
                                </CardContent>
                            </Card>
                        </Box>

                        {/* Import Jobs by Type */}
                        <Box sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}>
                            <Card>
                                <CardContent ref={importsTableRef}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            mb: 2,
                                        }}
                                    >
                                        <UploadIcon color="primary" />
                                        <Typography variant="h6">
                                            {t(
                                                "sections.imports_by_type",
                                                "Imports by Type"
                                            )}
                                        </Typography>
                                    </Box>
                                    {healthData &&
                                        (() => {
                                            // Prepare rows with summary row
                                            const importRows =
                                                healthData.imports.byType.map(
                                                    (importType) => ({
                                                        id: importType.importType,
                                                        importType:
                                                            importType.importType,
                                                        count24h:
                                                            importType.count24h,
                                                        count7d:
                                                            importType.count7d,
                                                        count30d:
                                                            importType.count30d,
                                                        totalRecords:
                                                            importType.totalRecords,
                                                        successRate:
                                                            importType.successRate,
                                                        pending: undefined, // Not available per type
                                                        recordsPerHour:
                                                            importType.recordsPerHour,
                                                        avgDurationSeconds:
                                                            importType.avgDurationSeconds,
                                                        isSummary: false,
                                                    })
                                                );

                                            // Add summary row
                                            const totalRecords =
                                                healthData.imports.byType.reduce(
                                                    (sum, type) =>
                                                        sum + type.totalRecords,
                                                    0
                                                );
                                            const summaryRow = {
                                                id: "summary",
                                                importType: t(
                                                    "common:total",
                                                    "Total"
                                                ),
                                                count24h:
                                                    healthData.imports.overview
                                                        .total24h,
                                                count7d:
                                                    healthData.imports.overview
                                                        .total7d,
                                                count30d:
                                                    healthData.imports.overview
                                                        .total30d,
                                                totalRecords: totalRecords,
                                                successRate:
                                                    healthData.imports.overview
                                                        .overallSuccessRate,
                                                pending:
                                                    healthData.imports.overview
                                                        .pendingCount,
                                                recordsPerHour:
                                                    healthData.imports.overview
                                                        .recordsPerHour,
                                                avgDurationSeconds:
                                                    healthData.imports.overview
                                                        .avgProcessingTimeSeconds,
                                                isSummary: true,
                                                stuckCount:
                                                    healthData.imports.overview
                                                        .stuckCount,
                                            };

                                            const allRows = [
                                                ...importRows,
                                                summaryRow,
                                            ];

                                            // Calculate height to show all rows (no scrolling)
                                            const ITEM_HEIGHT = 48; // Height of each row
                                            const HEADER_HEIGHT = 48; // Height of header
                                            const totalRowsHeight =
                                                allRows.length * ITEM_HEIGHT;
                                            const minHeight = 200; // Minimum height
                                            const calculatedHeight = Math.max(
                                                minHeight,
                                                HEADER_HEIGHT + totalRowsHeight
                                            );

                                            // Enhance columns to handle summary row styling
                                            const enhancedImportColumns =
                                                importColumns.map((col) => {
                                                    if (
                                                        col.field ===
                                                        "importType"
                                                    ) {
                                                        return {
                                                            ...col,
                                                            renderCell: (
                                                                params: any
                                                            ) => {
                                                                const isSummary =
                                                                    params.row
                                                                        .isSummary;
                                                                return (
                                                                    <Typography
                                                                        sx={{
                                                                            fontWeight:
                                                                                isSummary
                                                                                    ? 600
                                                                                    : 400,
                                                                        }}
                                                                    >
                                                                        {
                                                                            params.value
                                                                        }
                                                                    </Typography>
                                                                );
                                                            },
                                                        };
                                                    }
                                                    if (
                                                        col.field === "pending"
                                                    ) {
                                                        return {
                                                            ...col,
                                                            renderCell: (
                                                                params: any
                                                            ) => {
                                                                const isSummary =
                                                                    params.row
                                                                        .isSummary;
                                                                const stuckCount =
                                                                    params.row
                                                                        .stuckCount ||
                                                                    0;
                                                                if (
                                                                    isSummary &&
                                                                    params.value !==
                                                                        undefined
                                                                ) {
                                                                    return (
                                                                        <Box
                                                                            sx={{
                                                                                display:
                                                                                    "flex",
                                                                                flexDirection:
                                                                                    "column",
                                                                                alignItems:
                                                                                    "flex-end",
                                                                                gap: 0.5,
                                                                            }}
                                                                        >
                                                                            <Typography
                                                                                sx={{
                                                                                    fontWeight: 600,
                                                                                }}
                                                                                color={
                                                                                    params.value >
                                                                                    0
                                                                                        ? "warning.main"
                                                                                        : "text.primary"
                                                                                }
                                                                            >
                                                                                {
                                                                                    params.value
                                                                                }
                                                                            </Typography>
                                                                            {stuckCount >
                                                                                0 && (
                                                                                <Typography
                                                                                    variant="caption"
                                                                                    color="error.main"
                                                                                >
                                                                                    {t(
                                                                                        "fields.stuck",
                                                                                        "Stuck"
                                                                                    )}

                                                                                    :{" "}
                                                                                    {
                                                                                        stuckCount
                                                                                    }
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    );
                                                                }
                                                                return params.value !==
                                                                    undefined
                                                                    ? params.value
                                                                    : "-";
                                                            },
                                                        };
                                                    }
                                                    // Make summary row values bold
                                                    const originalRenderCell =
                                                        col.renderCell;
                                                    return {
                                                        ...col,
                                                        renderCell: (
                                                            params: any
                                                        ) => {
                                                            const isSummary =
                                                                params.row
                                                                    .isSummary;
                                                            const result =
                                                                originalRenderCell
                                                                    ? originalRenderCell(
                                                                          params
                                                                      )
                                                                    : params.value;
                                                            if (
                                                                isSummary &&
                                                                React.isValidElement(
                                                                    result
                                                                )
                                                            ) {
                                                                const element =
                                                                    result as React.ReactElement<any>;
                                                                const existingSx =
                                                                    (
                                                                        element.props as any
                                                                    )?.sx || {};
                                                                return React.cloneElement(
                                                                    element,
                                                                    {
                                                                        sx: {
                                                                            fontWeight: 600,
                                                                            ...existingSx,
                                                                        },
                                                                    }
                                                                );
                                                            }
                                                            if (
                                                                isSummary &&
                                                                (typeof result ===
                                                                    "string" ||
                                                                    typeof result ===
                                                                        "number")
                                                            ) {
                                                                return (
                                                                    <Typography
                                                                        sx={{
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {result}
                                                                    </Typography>
                                                                );
                                                            }
                                                            return result;
                                                        },
                                                    };
                                                });

                                            return (
                                                <EndlessScrollDataGrid
                                                    rows={allRows}
                                                    columns={
                                                        enhancedImportColumns
                                                    }
                                                    totalRecords={
                                                        allRows.length
                                                    }
                                                    isLoading={false}
                                                    onLoadMore={() => {}}
                                                    hasMore={false}
                                                    language={
                                                        i18n.language || "en"
                                                    }
                                                    height={{
                                                        xs: calculatedHeight,
                                                        sm: calculatedHeight,
                                                        md: calculatedHeight,
                                                    }}
                                                    hideToolbar={true}
                                                    resizableColumns={true}
                                                    noRowsMessage={t(
                                                        "common:messages.no_results",
                                                        "No imports found"
                                                    )}
                                                    noRowsDescription={t(
                                                        "common:messages.no_results_description",
                                                        "There are no imports in the system"
                                                    )}
                                                />
                                            );
                                        })()}
                                </CardContent>
                            </Card>
                        </Box>
                    </Box>
                </Box>
            )}
        </Fragment>
    );
};

export default SystemHealthContainer;
