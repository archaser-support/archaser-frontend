"use client";

// @ts-nocheck
// React imports
import {
    Assessment as AssessmentIcon,
    Clear as ClearIcon,
    ContentCopy as CopyIcon,
    InfoOutlined as InfoOutlinedIcon,
    PlayArrow as PlayIcon,
    Schedule as ScheduleIcon,
} from "@mui/icons-material";
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    FormControlLabel,
    LinearProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

// Shared components
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

// Translation
import { apiFetch } from "@/utils/apiFetch";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface CronJob {
    id: number;
    name: string;
    cronExpression: string;
    active: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    timeoutPeriodSeconds?: number;
    created_at: string;
    modifiedAt: string;
    status?: "running" | "idle" | "failed" | "completed" | "scheduled";
    logCount?: number;
    sortOrder: number;
}

interface CronJobOption {
    value: string;
    label: string;
    id: number;
}

const CronJobsPage = () => {
    // ============================================================================
    // HOOKS & CONTEXT
    // ============================================================================
    const { data: session } = useSession();
    const router = useRouter();
    const theme = useTheme();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const { t, i18n } = useTranslation(["common"]);
    const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);
    const [selectedJobOption, setSelectedJobOption] =
        useState<CronJobOption | null>(null);
    const [customerId, setCustomerId] = useState<string>("");
    const [customerIdError, setCustomerIdError] = useState<string>("");
    const [fastForwardScheduledActivities, setFastForwardScheduledActivities] =
        useState(false);
    const [skipSmsSend, setSkipSmsSend] = useState(false);
    const [realTimeLogs, setRealTimeLogs] = useState<string>("");
    const [logWindowHeight, setLogWindowHeight] = useState(500);
    const [isResizing, setIsResizing] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [triggeringJobId, setTriggeringJobId] = useState<number | null>(null);
    const [executionId, setExecutionId] = useState<string | null>(null);
    const [pollingInterval, setPollingInterval] =
        useState<NodeJS.Timeout | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isPollingRef = useRef<boolean>(false);
    const [seenLogIds, setSeenLogIds] = useState<Set<string>>(new Set());
    const [mainTab, setMainTab] = useState<"overview" | "details" | "debug">(
        "overview"
    );

    // ============================================================================
    // EFFECTS & ACCESS CONTROL
    // ============================================================================
    useEffect(() => {
        if (session?.user && session.user.account_id !== 10013) {
            showToast(
                "Access denied. Only account_id 10013 can access cron jobs debug.",
                "error"
            );
            router.push("/app/dashboard");
        }
    }, [session, router, showToast]);

    // Set page title
    useEffect(() => {
        document.title = "Cron Job Debugger - ARchaser";
    }, []);

    // ============================================================================
    // DATA FETCHING
    // ============================================================================
    const {
        data: cronJobs,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["cronJobs", "debug"],
        queryFn: async (): Promise<CronJob[]> => {
            const response = await apiFetch(
                "/api/system/admin/cron-jobs?debug=true"
            );
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to fetch cron jobs");
            }
            const result = await response.json();
            return result.cronJobs ?? result.data ?? [];
        },
        enabled: session?.user?.account_id === 10013,
    });

    const cronJobOptions: CronJobOption[] = useMemo(() => {
        if (!cronJobs || !Array.isArray(cronJobs)) {
            return [];
        }
        return cronJobs.map((job) => ({
            value: String(job.id),
            label: job.name,
            id: job.id,
        }));
    }, [cronJobs]);

    // Separate query for overall stats that doesn't refresh on job selection
    useQuery({
        queryKey: ["cronJobOverallStats"],
        queryFn: async () => {
            const url = `/api/admin/cron-jobs/stats?days=30`;
            const response = await apiFetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to fetch overall statistics"
                );
            }
            return response.json();
        },
        enabled: session?.user?.account_id === 10013,
        refetchInterval: 300000, // Refetch every 5 minutes
    });

    // Statistics query for job cards - doesn't refresh on job selection
    const {
        data: statsData,
        isLoading: statsLoading,
        error: statsError,
        refetch: refetchStats,
    } = useQuery({
        queryKey: ["cronJobStatsAllJobs"], // Static key - doesn't depend on selectedJob
        queryFn: async () => {
            // Always fetch all jobs for statistics section
            const allJobsUrl = `/api/admin/cron-jobs/stats?days=30`;

            // Fetch all jobs stats (for statistics section)
            const allJobsResponse = await apiFetch(allJobsUrl);
            if (!allJobsResponse.ok) {
                const errorData = await allJobsResponse.json();
                throw new Error(
                    errorData.error || "Failed to fetch statistics"
                );
            }
            return allJobsResponse.json();
        },
        enabled: session?.user?.account_id === 10013,
        refetchInterval: 300000, // Refetch every 5 minutes
    });

    // Separate query for detailed job stats (used in Overview/Details tabs)
    const { data: detailedJobStatsData } = useQuery({
        queryKey: ["cronJobDetailedStats", selectedJob?.id, mainTab],
        queryFn: async () => {
            if (
                !selectedJob ||
                (mainTab !== "overview" && mainTab !== "details")
            ) {
                return null;
            }

            const jobStatsUrl = `/api/admin/cron-jobs/stats?jobId=${selectedJob.id}&days=30&includeHistory=true&includeErrors=true`;
            const jobResponse = await apiFetch(jobStatsUrl);
            if (!jobResponse.ok) {
                const errorData = await jobResponse.json();
                throw new Error(
                    errorData.error || "Failed to fetch job statistics"
                );
            }
            return jobResponse.json();
        },
        enabled:
            session?.user?.account_id === 10013 &&
            selectedJob !== null &&
            (mainTab === "overview" || mainTab === "details"),
        refetchInterval: 300000, // Refetch every 5 minutes
    });

    const handleJobSelect = useCallback(
        (job: CronJob) => {
            setSelectedJob(job);
            setSelectedJobOption(
                cronJobOptions.find((option) => option.id === job.id) || null
            );
            setRealTimeLogs("");
            setSeenLogIds(new Set()); // Reset seen logs on job change
            stopLogPolling(); // Stop any active polling
            // Reset to overview tab when job changes
            setMainTab("overview");
            // Refetch stats when job changes
            refetchStats();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [cronJobOptions, refetchStats]
    );

    const handleJobOptionChange = useCallback(
        (newValue: CronJobOption | null) => {
            if (newValue) {
                const job = cronJobs?.find(
                    (j: CronJob) => j.id === newValue.id
                );
                if (job) {
                    handleJobSelect(job);
                }
            } else {
                setSelectedJob(null);
                setSelectedJobOption(null);
                setRealTimeLogs("");
                setSeenLogIds(new Set());
                stopLogPolling();
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [cronJobs, handleJobSelect]
    );

    const pollForLogs = async (execId: string) => {
        // Prevent concurrent polls
        if (isPollingRef.current) {
            return;
        }

        // Check if polling should continue (early exit if interval was cleared)
        if (!pollingIntervalRef.current) {
            return;
        }

        isPollingRef.current = true;

        try {
            const response = await apiFetch(`/api/system/admin/cron-jobs/logs/${execId}`
            );

            if (response.ok) {
                const data = await response.json();

                // Process logs first, even if execution is complete
                // This ensures users can see what happened during execution
                if (data.data?.logs && data.data.logs.length > 0) {
                    // Filter out logs we've already seen
                    const newLogs = data.data.logs.filter((log: any) => {
                        const logId =
                            log.id || `${log.timestamp}-${log.message}`;
                        return !seenLogIds.has(logId);
                    });

                    if (newLogs.length > 0) {
                        const newFormattedLogs = newLogs
                            .map((log: any) => {
                                const timestamp = new Date(
                                    log.timestamp
                                ).toLocaleString();
                                const level = log.level || "INFO";
                                const customerId = log.customerId
                                    ? `[${log.customerId}]`
                                    : "";
                                const message = log.message || "";
                                const parameters = log.parameters
                                    ? ` | Parameters: ${JSON.stringify(log.parameters, null, 2)}`
                                    : "";
                                const results = log.results
                                    ? ` | Results: ${JSON.stringify(log.results, null, 2)}`
                                    : "";
                                return `[${timestamp}] [${level}] ${customerId} ${message}${parameters}${results}`;
                            })
                            .join("\n");

                        // Append new logs instead of replacing
                        setRealTimeLogs((prev) => {
                            if (prev) {
                                const result = `${prev}\n${newFormattedLogs}`;
                                return result;
                            }
                            return newFormattedLogs;
                        });

                        // Update seen log IDs
                        const newLogIds = newLogs.map(
                            (log: any) =>
                                log.id || `${log.timestamp}-${log.message}`
                        );
                        setSeenLogIds((prev) => {
                            const newSet = new Set(prev);
                            newLogIds.forEach((id: string) => newSet.add(id));
                            return newSet;
                        });
                    }
                }

                // Check if execution is complete AFTER processing logs
                // This ensures we stop polling immediately when status is detected
                const executionStatus = data.data?.status;

                if (
                    executionStatus === "completed" ||
                    executionStatus === "failed"
                ) {
                    // Stop polling immediately - clear interval synchronously
                    const interval = pollingIntervalRef.current;
                    if (interval) {
                        clearInterval(interval);
                        pollingIntervalRef.current = null;
                        setPollingInterval(null);
                    }
                    isPollingRef.current = false;
                    setIsExecuting(false);
                    setTriggeringJobId(null);

                    // Invalidate customer timelines so new SCHEDULED activities appear after Activity Workflow Manager runs
                    if (selectedJob?.name === "Activity Workflow Manager") {
                        queryClient.invalidateQueries({
                            queryKey: ["customerTimeLineData"],
                            exact: false,
                        });
                    }

                    // Add completion message
                    const completionStatus =
                        executionStatus === "completed"
                            ? "COMPLETED"
                            : "FAILED";
                    const completionMessage = `[${new Date().toLocaleString()}] [${completionStatus}] Job execution finished with status: ${executionStatus}`;
                    setRealTimeLogs((prev) =>
                        prev
                            ? `${prev}\n${completionMessage}`
                            : completionMessage
                    );
                    // Exit after processing logs and detecting completion
                }
            } else {
                await response.text();

                // If the logs endpoint doesn't exist (404), stop polling and show a message
                if (response.status === 404) {
                    stopLogPolling();
                    setIsExecuting(false);
                    setTriggeringJobId(null);

                    const noLogsMessage = `[${new Date().toLocaleString()}] [WARNING] Real-time logs not available - logs endpoint not found`;
                    setRealTimeLogs((prev) =>
                        prev ? `${prev}\n${noLogsMessage}` : noLogsMessage
                    );
                }
            }
        } catch (_error) {
            // Error polling for logs
        } finally {
            isPollingRef.current = false;
        }
    };

    const startLogPolling = (execId: string) => {
        setExecutionId(execId);

        // Clear any existing interval first
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        // Poll every 1 second
        const interval = setInterval(() => {
            pollForLogs(execId);
        }, 1000);

        pollingIntervalRef.current = interval;
        setPollingInterval(interval);
    };

    const stopLogPolling = () => {
        const interval = pollingIntervalRef.current;
        if (interval) {
            clearInterval(interval);
            pollingIntervalRef.current = null;
            setPollingInterval(null);
        }
        isPollingRef.current = false;
        setExecutionId(null);
    };

    // Handle URL parameters after cronJobs is loaded
    useEffect(() => {
        if (!cronJobs) return;

        // Handle jobId parameter from URL - only if no job is currently selected
        const urlParams = new URLSearchParams(window.location.search);
        const jobIdParam = urlParams.get("jobId");
        if (jobIdParam && !selectedJob) {
            const job = cronJobs.find(
                (j: CronJob) => j.id === parseInt(jobIdParam)
            );
            if (job) {
                handleJobSelect(job);
            }
        }
    }, [cronJobs, selectedJob, handleJobSelect]);

    // Cleanup polling interval on unmount
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, []);

    // Trigger cron job mutation
    const triggerJobMutation = useMutation({
        mutationFn: async ({
            jobId,
            customerId,
            fastForwardScheduledActivities,
            skipSmsSend,
        }: {
            jobId: number;
            customerId?: number;
            fastForwardScheduledActivities?: boolean;
            skipSmsSend?: boolean;
        }) => {
            const response = await apiFetch("/api/system/admin/cron-jobs/trigger",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        jobId,
                        customerId,
                        fastForwardScheduledActivities,
                        skipSmsSend,
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const msg =
                    typeof errorData.error === "string"
                        ? errorData.error
                        : "Failed to trigger job";
                /** 409: job still marked active (another run in progress or not finished yet). */
                if (response.status === 409) {
                    const conflict = new Error(msg) as Error & {
                        isCronConcurrentConflict?: boolean;
                    };
                    conflict.isCronConcurrentConflict = true;
                    throw conflict;
                }
                throw new Error(msg);
            }

            const result = await response.json();
            return result;
        },
        onSuccess: (
            data: any,
            variables: {
                jobId: number;
                customerId?: number;
                fastForwardScheduledActivities?: boolean;
                skipSmsSend?: boolean;
            }
        ) => {
            // If we have an execution ID, start polling for real-time logs
            if (data.data?.executionId) {
                // Always append steps from the response so the full execution log is visible
                // (polling may return empty in serverless or different instance)
                if (data.result?.steps && data.result.steps.length > 0) {
                    const stepsFormatted = data.result.steps
                        .map((step: any) => {
                            const timestamp = new Date(
                                step.timestamp
                            ).toLocaleString();
                            const level = step.level || "INFO";
                            const stepNumber = step.stepNumber || "";
                            const message = step.message || "";
                            const parameters = step.parameters
                                ? `\n  Parameters: ${JSON.stringify(step.parameters, null, 2)}`
                                : "";
                            const results = step.results
                                ? `\n  Results: ${JSON.stringify(step.results, null, 2)}`
                                : "";
                            const duration = step.duration
                                ? ` (${step.duration}ms)`
                                : "";
                            return `[${timestamp}] [${level}] Step ${stepNumber}: ${message}${duration}${parameters}${results}`;
                        })
                        .join("\n");
                    setRealTimeLogs((prev) =>
                        prev ? `${prev}\n${stepsFormatted}` : stepsFormatted
                    );
                }
                startLogPolling(data.data.executionId);
            } else {
                // Handle detailed execution logs from the result
                if (data.result?.steps && data.result.steps.length > 0) {
                    const newFormattedLogs = data.result.steps
                        .map((step: any) => {
                            const timestamp = new Date(
                                step.timestamp
                            ).toLocaleString();
                            const level = step.level || "INFO";
                            const stepNumber = step.stepNumber || "";
                            const message = step.message || "";
                            const parameters = step.parameters
                                ? `\n  Parameters: ${JSON.stringify(step.parameters, null, 2)}`
                                : "";
                            const results = step.results
                                ? `\n  Results: ${JSON.stringify(step.results, null, 2)}`
                                : "";
                            const duration = step.duration
                                ? ` (${step.duration}ms)`
                                : "";
                            return `[${timestamp}] [${level}] Step ${stepNumber}: ${message}${duration}${parameters}${results}`;
                        })
                        .join("\n");

                    // Append new logs instead of replacing
                    setRealTimeLogs((prev) => {
                        if (prev) {
                            const result = `${prev}\n${newFormattedLogs}`;
                            return result;
                        }
                        return newFormattedLogs;
                    });
                } else {
                    // If no steps returned, show completion message
                    const completionMessage = variables.customerId
                        ? `[${new Date().toLocaleString()}] [COMPLETED] Execution completed successfully for customer ID ${variables.customerId}`
                        : `[${new Date().toLocaleString()}] [COMPLETED] Execution completed successfully for all customers`;
                    setRealTimeLogs((prev) =>
                        prev
                            ? `${prev}\n${completionMessage}`
                            : completionMessage
                    );
                }

                // Add execution summary if available
                if (data.result) {
                    const summary = [];
                    if (data.result.recordsProcessed > 0)
                        summary.push(
                            `Records Processed: ${data.result.recordsProcessed}`
                        );
                    if (data.result.recordsCreated > 0)
                        summary.push(
                            `Records Created: ${data.result.recordsCreated}`
                        );
                    if (data.result.recordsUpdated > 0)
                        summary.push(
                            `Records Updated: ${data.result.recordsUpdated}`
                        );
                    if (data.result.recordsDeleted > 0)
                        summary.push(
                            `Records Deleted: ${data.result.recordsDeleted}`
                        );
                    if (summary.length > 0) {
                        const summaryMessage = `\n[${new Date().toLocaleString()}] [SUMMARY] ${summary.join(", ")}`;
                        setRealTimeLogs((prev) =>
                            prev ? `${prev}\n${summaryMessage}` : summaryMessage
                        );
                    }

                    // Add performance metrics if available
                    if (
                        data.result.performanceMetrics &&
                        Object.keys(data.result.performanceMetrics).length > 0
                    ) {
                        const metrics = Object.entries(
                            data.result.performanceMetrics
                        )
                            .map(([key, value]) => `${key}: ${value}ms`)
                            .join(", ");
                        const metricsMessage = `\n[${new Date().toLocaleString()}] [PERFORMANCE] ${metrics}`;
                        setRealTimeLogs((prev) =>
                            prev ? `${prev}\n${metricsMessage}` : metricsMessage
                        );
                    }
                }

                // Always add a final completion message
                const finalCompletionMessage = `\n[${new Date().toLocaleString()}] [COMPLETED] Job execution finished successfully`;
                setRealTimeLogs((prev) =>
                    prev
                        ? `${prev}\n${finalCompletionMessage}`
                        : finalCompletionMessage
                );

                setIsExecuting(false);
                setTriggeringJobId(null);
                showToast("Debug execution completed successfully", "success");
            }

            // Refetch to get updated status
            refetch();
            queryClient.invalidateQueries({ queryKey: ["cronJobs"] });
            // Invalidate customer timelines so new SCHEDULED activities appear after Activity Workflow Manager runs
            if (selectedJob?.name === "Activity Workflow Manager") {
                queryClient.invalidateQueries({
                    queryKey: ["customerTimeLineData"],
                    exact: false,
                });
            }
        },
        onError: (error: Error) => {
            // Stop polling if it's running
            stopLogPolling();

            const isConcurrent =
                (error as Error & { isCronConcurrentConflict?: boolean })
                    .isCronConcurrentConflict === true;

            if (isConcurrent) {
                const warnLine = `[${new Date().toLocaleString()}] [WARNING] Trigger skipped: ${error.message}`;
                setRealTimeLogs((prev) =>
                    prev ? `${prev}\n${warnLine}` : warnLine
                );
                showToast(
                    "This job is already running. Wait for it to finish, or retry after a few minutes if the previous run ended abnormally.",
                    "warning"
                );
                setTriggeringJobId(null);
                setIsExecuting(false);
                return;
            }

            // Show detailed error in log area
            const errorMessage = `[${new Date().toLocaleString()}] [ERROR] Execution failed: ${error.message}`;
            const stackTrace = error.stack
                ? `\n  Stack Trace: ${error.stack}`
                : "";
            const fullErrorMessage = `${errorMessage}${stackTrace}`;
            setRealTimeLogs((prev) =>
                prev ? `${prev}\n${fullErrorMessage}` : fullErrorMessage
            );
            showToast(error.message || "Debug execution failed", "error");
            setTriggeringJobId(null);
            setIsExecuting(false);
        },
    });

    const validateCustomerId = (value: string): string => {
        // If empty, it's valid (will run for all customers)
        if (!value.trim()) return "";
        const numValue = parseInt(value.trim());
        if (isNaN(numValue) || numValue <= 0) {
            return "Customer ID must be a positive number";
        }
        return "";
    };

    const handleCustomerIdChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = event.target.value;
        setCustomerId(value);
        setCustomerIdError(validateCustomerId(value));
    };

    const handleCustomerIdKeyDown = (
        event: React.KeyboardEvent<HTMLInputElement>
    ) => {
        if (event.key === "Enter") {
            event.preventDefault();
            // Only execute if we have a valid job selected and valid customer ID
            if (
                selectedJob &&
                customerId.trim() &&
                !customerIdError &&
                !isExecuting
            ) {
                handleExecute();
            }
        }
    };

    const handleExecute = useCallback(() => {
        // Prevent duplicate executions
        if (isExecuting || triggeringJobId) {
            return;
        }

        if (!selectedJob) {
            showToast("Please select a cron job", "error");
            return;
        }

        const error = validateCustomerId(customerId);
        if (error) {
            setCustomerIdError(error);
            return;
        }

        // Clear execution logs when starting new execution
        setRealTimeLogs("");
        setSeenLogIds(new Set());

        setTriggeringJobId(selectedJob.id);
        setIsExecuting(true);

        // Add start message to logs
        const hasCustomerId = customerId.trim() !== "";
        const startMessage = hasCustomerId
            ? `[${new Date().toLocaleString()}] [INFO] Starting execution for job "${selectedJob.name}" with customer ID ${customerId.trim()}`
            : `[${new Date().toLocaleString()}] [INFO] Starting execution for job "${selectedJob.name}" for all customers (scheduler mode)`;
        setRealTimeLogs(startMessage);

        // Pass customerId only if provided, otherwise undefined for all customers
        const customerIdNum = hasCustomerId
            ? parseInt(customerId.trim())
            : undefined;
        triggerJobMutation.mutate({
            jobId: selectedJob.id,
            customerId: customerIdNum,
            fastForwardScheduledActivities,
            skipSmsSend,
        });
    }, [
        selectedJob,
        customerId,
        fastForwardScheduledActivities,
        skipSmsSend,
        isExecuting,
        triggeringJobId,
        showToast,
        triggerJobMutation,
    ]);

    const copyLogsToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(realTimeLogs);
            showToast("Logs copied to clipboard", "success");
        } catch (_error) {
            showToast("Failed to copy logs", "error");
        }
    };

    const clearLogs = () => {
        setRealTimeLogs("");
        setSeenLogIds(new Set());
        // Don't stop polling when clearing logs - user might want to see new logs
    };

    // Resize handlers for log window
    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);

        const handleMouseMove = (e: MouseEvent) => {
            const newHeight = Math.min(Math.max(400, e.clientY - 200), 800);
            setLogWindowHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    // ACCESS CONTROL & EARLY RETURNS
    if (session?.user && session.user.account_id !== 10013) {
        return (
            <Box sx={{ mt: 4 }}>
                <Alert severity="error">
                    <Typography variant="h6">Access Denied</Typography>
                    <Typography>
                        Only account_id 10013 can access cron jobs debug.
                    </Typography>
                </Alert>
            </Box>
        );
    }

    if (isLoading) {
        return (
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight="400px"
            >
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ mt: 4 }}>
                <Alert severity="error">
                    <Typography variant="h6">
                        Error Loading Cron Jobs
                    </Typography>
                    <Typography>
                        {error instanceof Error
                            ? error.message
                            : "An error occurred"}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={() => refetch()}
                        sx={{ mt: 2 }}
                    >
                        Retry
                    </Button>
                </Alert>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                borderRadius: theme.shape.borderRadius,
                px: { xs: 1, sm: 0 },
                pb: { xs: 2, sm: 0 },
            }}
        >
            {/* Header Section */}
            <PageHeader
                title="Cron Job Debugger"
                description="Debug cron jobs with specific customer ID or run for all customers (scheduler mode)"
            />

            <Stack spacing={{ xs: 2, sm: 3 }}>
                {/* Removed Overview Tab Content */}
                {false && selectedJob && (
                    <Card>
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
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
                                    <AssessmentIcon color="primary" />
                                    <Typography variant="h6">
                                        Overview -{" "}
                                        {selectedJob?.name || "Unknown"}
                                    </Typography>
                                </Box>
                                <Button
                                    size="small"
                                    onClick={() => refetchStats()}
                                    disabled={statsLoading}
                                >
                                    Refresh
                                </Button>
                            </Box>

                            {statsLoading && (
                                <Box
                                    display="flex"
                                    justifyContent="center"
                                    alignItems="center"
                                    minHeight="200px"
                                >
                                    <CircularProgress />
                                </Box>
                            )}

                            {statsError && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {(() => {
                                        const err = statsError!;
                                        return err instanceof Error
                                            ? err.message
                                            : String(err);
                                    })()}
                                </Alert>
                            )}

                            {!statsLoading &&
                                !statsError &&
                                statsData?.success ? (
                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "repeat(2, 1fr)",
                                            md: "repeat(4, 1fr)",
                                        },
                                        gap: 2,
                                    }}
                                >
                                    {selectedJob &&
                                        detailedJobStatsData?.success &&
                                        detailedJobStatsData.data.currentStats ? (
                                        // Single job stats - copy from statistics tab
                                        <>
                                            <Box>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Last Execution
                                                    </Typography>
                                                    <Typography variant="h6">
                                                        {detailedJobStatsData
                                                            .data.currentStats
                                                            .lastExecutionDuration
                                                            ? `${detailedJobStatsData.data.currentStats.lastExecutionDuration}s`
                                                            : "N/A"}
                                                    </Typography>
                                                </Paper>
                                            </Box>
                                            <Box>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Average Duration
                                                    </Typography>
                                                    <Typography variant="h6">
                                                        {detailedJobStatsData
                                                            .data.currentStats
                                                            .averageDuration
                                                            ? `${detailedJobStatsData.data.currentStats.averageDuration}s`
                                                            : "N/A"}
                                                    </Typography>
                                                </Paper>
                                            </Box>
                                            <Box>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Success Rate (30d)
                                                    </Typography>
                                                    <Typography variant="h6">
                                                        {detailedJobStatsData
                                                            .data.currentStats
                                                            .successRate
                                                            ? `${(
                                                                detailedJobStatsData
                                                                    .data
                                                                    .currentStats
                                                                    .successRate *
                                                                100
                                                            ).toFixed(1)}%`
                                                            : "N/A"}
                                                    </Typography>
                                                </Paper>
                                            </Box>
                                            <Box>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Total Executions (30d)
                                                    </Typography>
                                                    <Typography variant="h6">
                                                        {detailedJobStatsData
                                                            .data.currentStats
                                                            .totalExecutions30d ||
                                                            0}
                                                    </Typography>
                                                </Paper>
                                            </Box>
                                            <Box>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Success Count (30d)
                                                    </Typography>
                                                    <Typography
                                                        variant="h6"
                                                        color="success.main"
                                                    >
                                                        {detailedJobStatsData
                                                            .data.currentStats
                                                            .successCount30d ||
                                                            0}
                                                    </Typography>
                                                </Paper>
                                            </Box>
                                            <Box>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Failure Count (30d)
                                                    </Typography>
                                                    <Typography
                                                        variant="h6"
                                                        color="error.main"
                                                    >
                                                        {detailedJobStatsData
                                                            .data.currentStats
                                                            .failureCount30d ||
                                                            0}
                                                    </Typography>
                                                </Paper>
                                            </Box>
                                            <Box>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Timeout Count (30d)
                                                    </Typography>
                                                    <Typography
                                                        variant="h6"
                                                        color="warning.main"
                                                    >
                                                        {detailedJobStatsData
                                                            .data.currentStats
                                                            .timeoutCount30d ||
                                                            0}
                                                    </Typography>
                                                </Paper>
                                            </Box>
                                            <Box>
                                                <Paper
                                                    elevation={0}
                                                    sx={{
                                                        p: 2,
                                                        border: "1px solid",
                                                        borderColor: "divider",
                                                        borderRadius: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Performance Baseline
                                                    </Typography>
                                                    <Typography variant="h6">
                                                        {detailedJobStatsData
                                                            .data
                                                            .performanceBaseline
                                                            ? `${detailedJobStatsData.data.performanceBaseline}s`
                                                            : "N/A"}
                                                    </Typography>
                                                </Paper>
                                            </Box>
                                        </>
                                    ) : null}
                                </Box>
                            ) : !statsLoading && !statsError && !statsData ? (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    <Typography variant="body2">
                                        Statistics query is disabled.
                                        {session?.user?.account_id !==
                                            10013 && (
                                                <>
                                                    <br />
                                                    Your account ID:{" "}
                                                    <strong>
                                                        {session?.user
                                                            ?.account_id || "N/A"}
                                                    </strong>
                                                    <br />
                                                    Only account ID{" "}
                                                    <strong>10013</strong> can view
                                                    statistics.
                                                </>
                                            )}
                                    </Typography>
                                </Alert>
                            ) : !statsLoading &&
                                !statsError &&
                                statsData &&
                                !statsData.success ? (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    No statistics data available. The API
                                    returned: {JSON.stringify(statsData)}
                                </Alert>
                            ) : null}
                        </CardContent>
                    </Card>
                )}

                {/* Removed Detailed Stats Tab Content */}
                {false && selectedJob && (
                    <Card>
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
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
                                    <AssessmentIcon color="primary" />
                                    <Typography variant="h6">
                                        Detailed Stats -{" "}
                                        {selectedJob?.name || "Unknown"}
                                    </Typography>
                                </Box>
                                <Button
                                    size="small"
                                    onClick={() => refetchStats()}
                                    disabled={statsLoading}
                                >
                                    Refresh
                                </Button>
                            </Box>

                            {statsLoading && (
                                <Box
                                    display="flex"
                                    justifyContent="center"
                                    alignItems="center"
                                    minHeight="200px"
                                >
                                    <CircularProgress />
                                </Box>
                            )}

                            {statsError && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {(() => {
                                        const err = statsError!;
                                        return err instanceof Error
                                            ? err.message
                                            : String(err);
                                    })()}
                                </Alert>
                            )}

                            {!statsLoading &&
                                !statsError &&
                                statsData?.success ? (
                                <Box>
                                    {detailedJobStatsData?.success &&
                                        detailedJobStatsData.data
                                            .recentExecutions &&
                                        detailedJobStatsData.data
                                            .recentExecutions.length > 0 && (
                                            <Box sx={{ mb: 3 }}>
                                                <Typography
                                                    variant="h6"
                                                    gutterBottom
                                                >
                                                    Recent Executions
                                                </Typography>
                                                <TableContainer
                                                    component={Paper}
                                                    variant="outlined"
                                                >
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>
                                                                    Started At
                                                                </TableCell>
                                                                <TableCell>
                                                                    Duration
                                                                </TableCell>
                                                                <TableCell>
                                                                    Status
                                                                </TableCell>
                                                                <TableCell>
                                                                    Records
                                                                    Processed
                                                                </TableCell>
                                                                <TableCell>
                                                                    Peak
                                                                    Connections
                                                                </TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {detailedJobStatsData.data.recentExecutions.map(
                                                                (
                                                                    exec: any,
                                                                    idx: number
                                                                ) => (
                                                                    <TableRow
                                                                        key={
                                                                            idx
                                                                        }
                                                                    >
                                                                        <TableCell>
                                                                            {new Date(
                                                                                exec.startedAt
                                                                            ).toLocaleString()}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {exec.durationSeconds
                                                                                ? `${exec.durationSeconds}s`
                                                                                : "N/A"}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Chip
                                                                                label={
                                                                                    exec.status
                                                                                }
                                                                                size="small"
                                                                                color={
                                                                                    exec.status ===
                                                                                        "SUCCESS"
                                                                                        ? "success"
                                                                                        : exec.status ===
                                                                                            "FAILED"
                                                                                            ? "error"
                                                                                            : "warning"
                                                                                }
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {exec.recordsProcessed ||
                                                                                0}
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            {exec.peakConnections ||
                                                                                "N/A"}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            </Box>
                                        )}

                                    {detailedJobStatsData?.success &&
                                        detailedJobStatsData.data
                                            .errorBreakdown &&
                                        Object.keys(
                                            detailedJobStatsData.data
                                                .errorBreakdown
                                        ).length > 0 && (
                                            <Box sx={{ mb: 3 }}>
                                                <Typography
                                                    variant="h6"
                                                    gutterBottom
                                                >
                                                    Error Breakdown
                                                </Typography>
                                                <TableContainer
                                                    component={Paper}
                                                    variant="outlined"
                                                >
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>
                                                                    Error Type
                                                                </TableCell>
                                                                <TableCell>
                                                                    Count
                                                                </TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {detailedJobStatsData?.success &&
                                                                detailedJobStatsData
                                                                    .data
                                                                    .errorBreakdown &&
                                                                Object.entries(
                                                                    detailedJobStatsData
                                                                        .data
                                                                        .errorBreakdown
                                                                ).map(
                                                                    ([
                                                                        errorType,
                                                                        count,
                                                                    ]: [
                                                                            string,
                                                                            any,
                                                                        ]) => (
                                                                        <TableRow
                                                                            key={
                                                                                errorType
                                                                            }
                                                                        >
                                                                            <TableCell>
                                                                                {
                                                                                    errorType
                                                                                }
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {
                                                                                    count
                                                                                }
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    )
                                                                )}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            </Box>
                                        )}

                                    {detailedJobStatsData?.success &&
                                        detailedJobStatsData.data
                                            .performanceTrend &&
                                        detailedJobStatsData.data
                                            .performanceTrend.length > 0 && (
                                            <Box>
                                                <Typography
                                                    variant="h6"
                                                    gutterBottom
                                                >
                                                    Performance Trend
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    Trend Direction:{" "}
                                                    {statsData.data
                                                        .performanceTrendDirection ||
                                                        "N/A"}
                                                </Typography>
                                                <TableContainer
                                                    component={Paper}
                                                    variant="outlined"
                                                    sx={{ mt: 2 }}
                                                >
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell>
                                                                    Date
                                                                </TableCell>
                                                                <TableCell>
                                                                    Duration (s)
                                                                </TableCell>
                                                                <TableCell>
                                                                    Status
                                                                </TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {detailedJobStatsData.data.performanceTrend
                                                                .slice(-10)
                                                                .map(
                                                                    (
                                                                        trend: any,
                                                                        idx: number
                                                                    ) => (
                                                                        <TableRow
                                                                            key={
                                                                                idx
                                                                            }
                                                                        >
                                                                            <TableCell>
                                                                                {new Date(
                                                                                    trend.date
                                                                                ).toLocaleDateString()}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {trend.duration.toFixed(
                                                                                    2
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <Chip
                                                                                    label={
                                                                                        trend.status
                                                                                    }
                                                                                    size="small"
                                                                                    color={
                                                                                        trend.status ===
                                                                                            "SUCCESS"
                                                                                            ? "success"
                                                                                            : "error"
                                                                                    }
                                                                                />
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    )
                                                                )}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            </Box>
                                        )}
                                </Box>
                            ) : !statsLoading && !statsError && !statsData ? (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    <Typography variant="body2">
                                        Statistics query is disabled.
                                        {session?.user?.account_id !==
                                            10013 && (
                                                <>
                                                    <br />
                                                    Your account ID:{" "}
                                                    <strong>
                                                        {session?.user
                                                            ?.account_id || "N/A"}
                                                    </strong>
                                                    <br />
                                                    Only account ID{" "}
                                                    <strong>10013</strong> can view
                                                    statistics.
                                                </>
                                            )}
                                    </Typography>
                                </Alert>
                            ) : !statsLoading &&
                                !statsError &&
                                statsData &&
                                !statsData.success ? (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    No statistics data available. The API
                                    returned: {JSON.stringify(statsData)}
                                </Alert>
                            ) : null}
                        </CardContent>
                    </Card>
                )}

                {/* DEBUG Tab Content */}
                <>
                    <Card>
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                            <Typography
                                variant="h6"
                                sx={{
                                    mb: { xs: 1.5, sm: 2 },
                                    fontSize: { xs: "1.125rem", sm: "1.25rem" },
                                }}
                            >
                                Debug Configuration
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    mb: { xs: 1.5, sm: 2 },
                                    fontSize: { xs: "0.875rem", sm: "1rem" },
                                    display: { xs: "none", sm: "block" },
                                }}
                            >
                                Enter a specific customer ID to test with that
                                customer, or leave empty to run for all
                                customers (simulating scheduler behavior)
                            </Typography>
                            <Stack spacing={2}>
                                {/* Row 1: Cron job dropdown, Customer ID, Execute button */}
                                <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={{ xs: 2, sm: 2 }}
                                    alignItems={{ xs: "stretch", sm: "flex-start" }}
                                >
                                    {/* Cron Job Selection Dropdown */}
                                    <Autocomplete<CronJobOption>
                                        value={selectedJobOption}
                                        onChange={(event, newValue) =>
                                            handleJobOptionChange(newValue)
                                        }
                                        options={cronJobOptions}
                                        getOptionLabel={(option: CronJobOption) =>
                                            option.label
                                        }
                                        isOptionEqualToValue={(
                                            option: CronJobOption,
                                            value: CronJobOption
                                        ) => option.value === value?.value}
                                        disabled={cronJobOptions.length === 0}
                                        sx={{ flex: { xs: 1, sm: 2 } }}
                                        renderInput={(params: any) => (
                                            <TextField
                                                {...params}
                                                label="Choose a cron job"
                                                size="small"
                                                fullWidth
                                                sx={{
                                                    "& .MuiInputBase-root": {
                                                        height: {
                                                            xs: "48px",
                                                            sm: "40px",
                                                        },
                                                    },
                                                }}
                                            />
                                        )}
                                        renderOption={(
                                            props: any,
                                            option: CronJobOption
                                        ) => {
                                            const { key, ...otherProps } = props;
                                            return (
                                                <li key={key} {...otherProps}>
                                                    <Typography variant="subtitle2">
                                                        {option.label}
                                                    </Typography>
                                                </li>
                                            );
                                        }}
                                        noOptionsText="No cron jobs available"
                                    />

                                    {/* Customer ID Field */}
                                    <TextField
                                        label="Customer ID (Optional)"
                                        placeholder="Enter customer ID or leave empty for all customers"
                                        value={customerId}
                                        onChange={handleCustomerIdChange}
                                        error={!!customerIdError}
                                        helperText={customerIdError || ""}
                                        type="number"
                                        inputProps={{
                                            min: 1,
                                            onKeyDown: handleCustomerIdKeyDown,
                                        }}
                                        disabled={isExecuting}
                                        size="small"
                                        sx={{
                                            flex: { xs: 1, sm: 1 },
                                            "& .MuiInputBase-root": {
                                                height: { xs: "48px", sm: "40px" },
                                            },
                                        }}
                                    />

                                    {/* Execute Button */}
                                    <Button
                                        variant="contained"
                                        startIcon={<PlayIcon />}
                                        onClick={handleExecute}
                                        disabled={
                                            !selectedJob ||
                                            !!customerIdError ||
                                            isExecuting
                                        }
                                        size="small"
                                        sx={{
                                            flex: { xs: 1, sm: 1 },
                                            // Use conditional margins for proper RTL spacing
                                            mr: i18n.language === "he" ? 1 : 0,
                                            ml: i18n.language === "he" ? 0 : 1,
                                            // Add spacing between icon and text for Hebrew
                                            ...(i18n.language === "he" && {
                                                gap: "8px",
                                                "& .MuiButton-startIcon": {
                                                    marginLeft: "8px",
                                                    marginRight: 0,
                                                },
                                            }),
                                        }}
                                    >
                                        {isExecuting
                                            ? "Executing..."
                                            : customerId.trim()
                                                ? "Execute with Customer ID"
                                                : "Execute for All Customers"}
                                    </Button>
                                </Stack>

                                {/* Row 2: Checkboxes - show for Activity Workflow Manager, Move Collection To Next Category, and Process Due Notifications */}
                                {(selectedJob?.name ===
                                    "Activity Workflow Manager" ||
                                    selectedJob?.name ===
                                    "Move Collection To Next Category" ||
                                    selectedJob?.name ===
                                    "Process Due Notifications") && (
                                        <Stack
                                            direction="row"
                                            spacing={3}
                                            flexWrap="wrap"
                                            useFlexGap
                                            sx={{ mt: 1 }}
                                        >
                                            <Box
                                                sx={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 0.25,
                                                }}
                                            >
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={
                                                                fastForwardScheduledActivities
                                                            }
                                                            onChange={(e) =>
                                                                setFastForwardScheduledActivities(
                                                                    e.target.checked
                                                                )
                                                            }
                                                            disabled={isExecuting}
                                                            size="small"
                                                        />
                                                    }
                                                    label={t(
                                                        "fields.fast_forward_scheduled_activities",
                                                        {
                                                            ns: "common",
                                                            defaultValue:
                                                                "Fast-forward scheduled activities (for testing)",
                                                        }
                                                    )}
                                                    sx={{
                                                        "& .MuiFormControlLabel-label":
                                                        {
                                                            fontSize: "0.875rem",
                                                        },
                                                    }}
                                                />
                                                <Tooltip
                                                    title={
                                                        <Box
                                                            component="span"
                                                            sx={{
                                                                display: "block",
                                                                maxWidth: 360,
                                                                py: 0.5,
                                                            }}
                                                        >
                                                            <Typography
                                                                component="span"
                                                                variant="body2"
                                                                sx={{
                                                                    display: "block",
                                                                    whiteSpace: "pre-line",
                                                                }}
                                                            >
                                                                {selectedJob?.name ===
                                                                    "Activity Workflow Manager"
                                                                    ? "Activity Workflow Manager: Sets next activity schedule times and next_category_date to 1 hour in the past so they are due immediately. Scheduled activities may be moved to the past so Phase 1 can send them in the same run.\n\nUse for testing only."
                                                                    : selectedJob?.name ===
                                                                        "Move Collection To Next Category"
                                                                        ? "Move Collection To Next Category: Bypasses the account setting wait_days_after_automated.\n\nCollections with next_category=Agent and next_category_date in the past will transition to Agent immediately instead of waiting the configured number of days.\n\nUse for testing only."
                                                                        : selectedJob?.name ===
                                                                            "Process Due Notifications"
                                                                            ? "Process Due Notifications: Sets schedule_time to 1 hour in the past so created activities are due immediately. Run Activity Workflow Manager after to send (use Skip SMS for dry run).\n\nUse for testing only."
                                                                            : ""}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    placement="bottom"
                                                    enterDelay={400}
                                                    leaveDelay={0}
                                                >
                                                    <InfoOutlinedIcon
                                                        sx={{
                                                            fontSize: 18,
                                                            color: "action.active",
                                                            cursor: "help",
                                                        }}
                                                    />
                                                </Tooltip>
                                            </Box>
                                            {(selectedJob?.name ===
                                                "Activity Workflow Manager" ||
                                                selectedJob?.name ===
                                                "Process Due Notifications") && (
                                                    <Box
                                                        sx={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: 0.25,
                                                        }}
                                                    >
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={
                                                                        skipSmsSend
                                                                    }
                                                                    onChange={(e) =>
                                                                        setSkipSmsSend(
                                                                            e.target
                                                                                .checked
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        isExecuting
                                                                    }
                                                                    size="small"
                                                                />
                                                            }
                                                            label={t(
                                                                "fields.skip_sms_send",
                                                                {
                                                                    ns: "common",
                                                                    defaultValue:
                                                                        "Skip actual SMS send (for testing)",
                                                                }
                                                            )}
                                                            sx={{
                                                                "& .MuiFormControlLabel-label":
                                                                {
                                                                    fontSize: "0.875rem",
                                                                },
                                                            }}
                                                        />
                                                        <Tooltip
                                                            title={
                                                                <Box
                                                                    component="span"
                                                                    sx={{
                                                                        display: "block",
                                                                        maxWidth: 360,
                                                                        py: 0.5,
                                                                    }}
                                                                >
                                                                    <Typography
                                                                        component="span"
                                                                        variant="body2"
                                                                        sx={{
                                                                            display: "block",
                                                                            whiteSpace: "pre-line",
                                                                        }}
                                                                    >
                                                                        Activity Workflow Manager only: No SMS messages are sent to vendors (Twilio, etc.).
                                                                        {"\n\n"}
                                                                        Activities are still marked as delivered and last-step logic (e.g. setting next_category=Agent) runs as usual.
                                                                        {"\n\n"}
                                                                        Use for testing without sending real SMS.
                                                                    </Typography>
                                                                </Box>
                                                            }
                                                            placement="bottom"
                                                            enterDelay={400}
                                                            leaveDelay={0}
                                                        >
                                                            <InfoOutlinedIcon
                                                                sx={{
                                                                    fontSize: 18,
                                                                    color: "action.active",
                                                                    cursor: "help",
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    </Box>
                                                )}
                                        </Stack>
                                    )}
                            </Stack>
                        </CardContent>
                    </Card>

                    {selectedJob && (
                        <Card>
                            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: {
                                            xs: "column",
                                            sm: "row",
                                        },
                                        justifyContent: "space-between",
                                        alignItems: {
                                            xs: "flex-start",
                                            sm: "center",
                                        },
                                        mb: 2,
                                        gap: { xs: 1.5, sm: 0 },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                            gap: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="h6"
                                            sx={{
                                                fontSize: {
                                                    xs: "1rem",
                                                    sm: "1.25rem",
                                                },
                                            }}
                                        >
                                            Execution Logs
                                        </Typography>
                                        {isExecuting && (
                                            <Chip
                                                label="Executing..."
                                                color="primary"
                                                size="small"
                                                sx={{
                                                    ml: { xs: 0, sm: 2 },
                                                    fontSize: {
                                                        xs: "0.7rem",
                                                        sm: "0.75rem",
                                                    },
                                                    height: {
                                                        xs: "24px",
                                                        sm: "28px",
                                                    },
                                                }}
                                            />
                                        )}
                                    </Box>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            gap: { xs: 1, sm: 1 },
                                            width: { xs: "100%", sm: "auto" },
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        {isExecuting && (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                onClick={() => {
                                                    stopLogPolling();
                                                    setIsExecuting(false);
                                                    setTriggeringJobId(null);

                                                    // Add manual stop completion message
                                                    const stopMessage = `[${new Date().toLocaleString()}] [STOPPED] Job execution manually stopped by user`;
                                                    setRealTimeLogs((prev) =>
                                                        prev
                                                            ? `${prev}\n${stopMessage}`
                                                            : stopMessage
                                                    );
                                                }}
                                                sx={{
                                                    minHeight: {
                                                        xs: "40px",
                                                        sm: "32px",
                                                    },
                                                    flex: {
                                                        xs: "1 1 auto",
                                                        sm: "0 0 auto",
                                                    },
                                                }}
                                            >
                                                Stop
                                            </Button>
                                        )}
                                        <Button
                                            size="small"
                                            startIcon={<CopyIcon />}
                                            onClick={copyLogsToClipboard}
                                            disabled={!realTimeLogs}
                                            sx={{
                                                minHeight: {
                                                    xs: "40px",
                                                    sm: "32px",
                                                },
                                                flex: {
                                                    xs: "1 1 auto",
                                                    sm: "0 0 auto",
                                                },
                                            }}
                                        >
                                            Copy
                                        </Button>
                                        <Button
                                            size="small"
                                            startIcon={<ClearIcon />}
                                            onClick={clearLogs}
                                            disabled={!realTimeLogs}
                                            sx={{
                                                minHeight: {
                                                    xs: "40px",
                                                    sm: "32px",
                                                },
                                                flex: {
                                                    xs: "1 1 auto",
                                                    sm: "0 0 auto",
                                                },
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    </Box>
                                </Box>

                                {isExecuting && (
                                    <LinearProgress sx={{ mb: 2 }} />
                                )}

                                <Box
                                    sx={{
                                        height: {
                                            xs: "300px",
                                            sm: `${logWindowHeight}px`,
                                        },
                                        minHeight: { xs: "300px", sm: "400px" },
                                        maxHeight: { xs: "500px", sm: "800px" },
                                        position: "relative",
                                        border: "1px solid",
                                        borderColor: "divider",
                                        borderRadius: 1,
                                        overflow: "hidden",
                                    }}
                                >
                                    <Box
                                        sx={{
                                            height: "100%",
                                            overflow: "auto",
                                            overflowY: "scroll",
                                            padding: { xs: 1.5, sm: 2 },
                                            fontFamily: "monospace",
                                            fontSize: {
                                                xs: "0.75rem",
                                                sm: "0.875rem",
                                            },
                                            lineHeight: 1.4,
                                            backgroundColor: "background.paper",
                                            border: "1px solid",
                                            borderColor: "divider",
                                            borderRadius: 1,
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-word",
                                            "&::-webkit-scrollbar": {
                                                width: "12px",
                                            },
                                            "&::-webkit-scrollbar-track": {
                                                backgroundColor:
                                                    "rgba(0, 0, 0, 0.1)",
                                                borderRadius: "6px",
                                            },
                                            "&::-webkit-scrollbar-thumb": {
                                                backgroundColor:
                                                    "rgba(0, 0, 0, 0.3)",
                                                borderRadius: "6px",
                                                border: "2px solid transparent",
                                                backgroundClip: "content-box",
                                                "&:hover": {
                                                    backgroundColor:
                                                        "rgba(0, 0, 0, 0.5)",
                                                },
                                            },
                                        }}
                                    >
                                        {realTimeLogs ||
                                            "Execution logs will appear here when you run a job..."}
                                    </Box>

                                    <Box
                                        onMouseDown={handleResizeStart}
                                        sx={{
                                            position: "absolute",
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            height: "8px",
                                            cursor: "ns-resize",
                                            backgroundColor: "transparent",
                                            "&:hover": {
                                                backgroundColor:
                                                    "rgba(0, 0, 0, 0.1)",
                                            },
                                            "&:active": {
                                                backgroundColor:
                                                    "rgba(0, 0, 0, 0.2)",
                                            },
                                        }}
                                    />
                                </Box>
                            </CardContent>
                        </Card>
                    )}
                </>
            </Stack>
        </Box>
    );
};

export default CronJobsPage;
