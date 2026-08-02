import { apiFetch } from "@/utils/apiFetch";
import {
    Warning as WarningIcon,
    Error as ErrorIcon,
    PlayArrow as PlayArrowIcon,
} from "@mui/icons-material";
import {
    Card,
    CardContent,
    CardHeader,
    Typography,
    Chip,
    CircularProgress,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Button,
    Alert,
    Container,
    Stack,
    Tooltip,
    Snackbar,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

interface CronJob {
    id: number;
    name: string;
    cron_expression: string;
    active: boolean;
    last_run_at: string | null;
    next_run_at: string | null;
    created_at: string;
    modified_at: string | null;
    isRunning: boolean;
    runningDuration: number;
}

interface RunningJob {
    id: number;
    name: string;
    duration: number;
}

interface CronJobMonitorData {
    jobs: CronJob[];
    runningJobs: {
        over2Min: RunningJob[];
        over30Min: RunningJob[];
    };
}

const StyledCard = styled(Card)(({ theme }) => ({
    marginBottom: theme.spacing(3),
}));

// API function
const fetchCronJobStats = async (): Promise<CronJobMonitorData> => {
    const response = await apiFetch("/api/system/admin/dashboard");
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Failed to fetch cron job data");
    }

    return (result.data ?? result) as CronJobMonitorData;
};

const CronJobMonitor: React.FC = () => {
    const { t } = useTranslation(["common"]);
    const [triggeringJob, setTriggeringJob] = useState<number | null>(null);
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error";
    }>({
        open: false,
        message: "",
        severity: "success",
    });

    const queryClient = useQueryClient();
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["cronJobStats"],
        queryFn: fetchCronJobStats,
        refetchInterval: 300000, // Refetch every 5 minutes
        refetchIntervalInBackground: false,
        staleTime: 60000, // Consider data stale after 1 minute
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const formatDuration = (ms: number) => {
        const hours = Math.floor(ms / (60 * 60 * 1000));
        const minutes = Math.floor((ms % (60 * 60 * 1000)) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "SUCCESS":
            case "COMPLETED":
                return "success";
            case "FAILED":
            case "ERROR":
                return "error";
            case "SKIPPED":
                return "warning";
            default:
                return "info";
        }
    };

    const handleTriggerJob = async (jobId: number, jobName: string) => {
        setTriggeringJob(jobId);
        try {
            const response = await apiFetch("/api/system/admin/cron-jobs/trigger",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ jobId }),
                }
            );

            const result = await response.json();

            if (result.success) {
                setSnackbar({
                    open: true,
                    message: `Job "${jobName}" triggered successfully!`,
                    severity: "success",
                });
                // Refetch the data to update the UI
                queryClient.invalidateQueries({ queryKey: ["cronJobStats"] });
            } else {
                throw new Error(result.error || "Failed to trigger job");
            }
        } catch (error) {
            setSnackbar({
                open: true,
                message: `Failed to trigger job "${jobName}": ${error instanceof Error ? error.message : "Unknown error"}`,
                severity: "error",
            });
        } finally {
            setTriggeringJob(null);
        }
    };

    const handleCloseSnackbar = () => {
        setSnackbar((prev) => ({ ...prev, open: false }));
    };

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
            <Container maxWidth="md">
                <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Error Loading Cron Job Monitor
                    </Typography>
                    <Typography variant="body2">
                        {error instanceof Error
                            ? error.message
                            : "An error occurred"}
                    </Typography>
                </Alert>
                <Button
                    variant="contained"
                    onClick={() => refetch()}
                    sx={{ mt: 2 }}
                >
                    Retry
                </Button>
            </Container>
        );
    }

    if (!data) {
        return (
            <Container maxWidth="md">
                <Alert severity="info">
                    <Typography>
                        {t("messages.no_data", { ns: "common" })}
                    </Typography>
                </Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl">
            <Stack spacing={3}>
                {/* Warning Banners */}
                {data.runningJobs.over30Min.length > 0 && (
                    <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Critical: Jobs Running Over 30 Minutes
                        </Typography>
                        <Stack spacing={1}>
                            {data.runningJobs.over30Min.map((job) => (
                                <Typography key={job.id} variant="body2">
                                    • <strong>{job.name}</strong> has been
                                    running for{" "}
                                    <strong>
                                        {formatDuration(job.duration)}
                                    </strong>
                                </Typography>
                            ))}
                        </Stack>
                    </Alert>
                )}

                {data.runningJobs.over2Min.length > 0 && (
                    <Alert
                        severity="warning"
                        icon={<WarningIcon />}
                        sx={{ mb: 2 }}
                    >
                        <Typography variant="h6" gutterBottom>
                            Warning: Jobs Running Over 2 Minutes
                        </Typography>
                        <Stack spacing={1}>
                            {data.runningJobs.over2Min.map((job) => (
                                <Typography key={job.id} variant="body2">
                                    • <strong>{job.name}</strong> has been
                                    running for{" "}
                                    <strong>
                                        {formatDuration(job.duration)}
                                    </strong>
                                </Typography>
                            ))}
                        </Stack>
                    </Alert>
                )}

                {/* Job Statistics */}
                <StyledCard>
                    <CardHeader title="Cron Jobs" />
                    <CardContent>
                        <TableContainer component={Paper} variant="outlined">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Job Name</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Last Run</TableCell>
                                        <TableCell>Next Run</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.jobs.map((job) => (
                                        <TableRow key={job.id}>
                                            <TableCell>
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight="medium"
                                                    >
                                                        {job.name}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        {job.cron_expression}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={
                                                        job.active
                                                            ? "Active"
                                                            : "Inactive"
                                                    }
                                                    size="small"
                                                    data-status={
                                                        job.active
                                                            ? "active"
                                                            : "inactive"
                                                    }
                                                    clickable={false}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {job.last_run_at ? (
                                                    <Typography variant="body2">
                                                        {formatDate(
                                                            job.last_run_at
                                                        )}
                                                    </Typography>
                                                ) : (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        Never
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {job.next_run_at ? (
                                                    <Typography variant="body2">
                                                        {formatDate(
                                                            job.next_run_at
                                                        )}
                                                    </Typography>
                                                ) : (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        Not scheduled
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title="Trigger job now">
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={
                                                            triggeringJob ===
                                                            job.id ? (
                                                                <CircularProgress
                                                                    size={16}
                                                                />
                                                            ) : (
                                                                <PlayArrowIcon />
                                                            )
                                                        }
                                                        onClick={() =>
                                                            handleTriggerJob(
                                                                job.id,
                                                                job.name
                                                            )
                                                        }
                                                        disabled={
                                                            triggeringJob ===
                                                                job.id ||
                                                            job.isRunning
                                                        }
                                                        sx={{
                                                            minWidth: "auto",
                                                            px: 1,
                                                            py: 0.5,
                                                            fontSize: "0.75rem",
                                                        }}
                                                    >
                                                        {triggeringJob ===
                                                        job.id
                                                            ? "Triggering..."
                                                            : "Trigger Now"}
                                                    </Button>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </StyledCard>
            </Stack>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert
                    onClose={handleCloseSnackbar}
                    severity={snackbar.severity}
                    sx={{ width: "100%" }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default CronJobMonitor;
