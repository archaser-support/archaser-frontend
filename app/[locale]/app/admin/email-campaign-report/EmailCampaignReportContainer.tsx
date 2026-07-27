"use client";
import { FilterList as FilterIcon } from "@mui/icons-material";
import {
    Box,
    Typography,
    Paper,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Autocomplete,
    Button,
    CircularProgress,
    useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import api from "@/app/api";
import moment from "moment";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import EmailCampaignReportTable from "@/components/EmailCampaignReport/EmailCampaignReportTable";
import EmailCampaignSummary from "@/components/EmailCampaignReport/EmailCampaignSummary";
import PageHeader from "@/components/PageHeader";

interface EmailCampaignReport {
    summary: {
        totalEmailActivities: number;
        totalEmailContacts?: number;
        sent: number;
        delivered: number;
        bounced: number;
        failed?: number;
        opened: number;
        clicked: number;
        deliveryRate: number;
        openRate: number;
        clickRate: number;
        bounceRate: number;
    };
    data: Array<{
        id: string;
        sendingDateTime: string;
        accountName: string;
        customerCode: string;
        emailType: string;
        deliveryStatus: string;
        clicked: boolean;
        opened: boolean;
        viewCount: number;
        openedTime?: string;
        clickedTime?: string;
        recipientEmail: string;
        recipientName: string;
    }>;
    pagination?: {
        totalRecords: number;
        totalPages: number;
    };
}

interface _Customer {
    id: number;
    name: string;
}

const EmailCampaignReportContainer = () => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { t } = useTranslation(["admin", "common"]);
    const theme = useTheme();

    // State for filters
    const [filters, setFilters] = useState({
        startDate: moment().format("YYYY-MM-DD"), // Default to current date
        endDate: moment().format("YYYY-MM-DD"), // Default to current date
        accountId: "",
        emailType: "Email", // Default to Email channel
    });

    // State for pagination
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50, // Start with 50 records per page
        totalRecords: 0,
        totalPages: 0,
    });

    // Communication channel options for filter dropdown
    const activityCategories = [
        { value: "Email", label: "Email" },
        { value: "SMS", label: "SMS" },
        { value: "WhatsApp", label: "WhatsApp" },
    ];

    const [customers, setCustomers] = useState<any[]>([]);
    const [customersLoading, setCustomersLoading] = useState(false);

    // Fetch customers for filter dropdown (only those with email campaign data)
    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                setCustomersLoading(true);
                const response = await api.get(
                    "/api/admin/email-campaign-customers"
                );
                setCustomers(response.data?.customers || []);
            } catch (_error) {
                console.error("Error fetching accounts:", _error);
                setCustomers([]);
            } finally {
                setCustomersLoading(false);
            }
        };

        if (status === "authenticated") {
            fetchCustomers();
        }
    }, [status]);

    // Fetch email campaign report data
    const {
        data: reportData,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: [
            "email-campaign-report",
            filters,
            pagination.page,
            pagination.limit,
        ],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters.startDate)
                params.append("startDate", filters.startDate);
            if (filters.endDate) params.append("endDate", filters.endDate);
            if (filters.accountId)
                params.append("accountId", filters.accountId);
            if (filters.emailType)
                params.append("emailType", filters.emailType);

            // Add pagination parameters
            params.append("page", pagination.page.toString());
            params.append("limit", pagination.limit.toString());

            // Add cache-busting parameter
            params.append("_t", Date.now().toString());

            const response = await api.get(
                `/api/admin/email-campaign-report?${params.toString()}`
            );
            const data = response.data as EmailCampaignReport;

            // Add id field to each data item if it doesn't exist
            if (data.data) {
                data.data = data.data.map((item, index) => ({
                    ...item,
                    id: item.id || `email-${index}`,
                }));
            }

            // Update pagination state with server response
            if (data.pagination) {
                setPagination((prev) => ({
                    ...prev,
                    totalRecords: data.pagination?.totalRecords ?? 0,
                    totalPages: data.pagination?.totalPages ?? 0,
                }));
            }

            return data;
        },
        enabled: status === "authenticated",
        staleTime: 0, // Always consider data stale
        gcTime: 0, // Don't cache data (replaced cacheTime)
        refetchOnMount: true, // Always refetch on mount
        refetchOnWindowFocus: true, // Refetch when window gains focus
    });

    // Show loading state when session is loading
    if (status === "loading") {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "400px",
                }}
            >
                <CircularProgress size={40} />
            </Box>
        );
    }

    // Redirect if not admin
    if (status === "unauthenticated" || !session?.user) {
        router.push("/login");
        return null;
    }

    const isAdmin =
        session.user.role === "Admin" || session.user.account_id === 10013;
    if (!isAdmin) {
        router.push("/app/dashboard");
        return null;
    }

    const handleFilterChange = (field: string, value: string) => {
        setFilters((prev) => ({
            ...prev,
            [field]: value,
        }));
        // Reset to first page when filters change
        setPagination((prev) => ({ ...prev, page: 1 }));
    };

    const _handleExport = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.startDate)
                params.append("startDate", filters.startDate);
            if (filters.endDate) params.append("endDate", filters.endDate);
            if (filters.accountId)
                params.append("accountId", filters.accountId);
            if (filters.emailType)
                params.append("emailType", filters.emailType);
            params.append("export", "true");

            const response = await api.get(
                `/api/admin/email-campaign-report?${params.toString()}`,
                {
                    responseType: "blob",
                }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute(
                "download",
                `email-campaign-report-${moment().format("YYYY-MM-DD")}.csv`
            );
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Export error:", error);
        }
    };

    if (error) {
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
                    {t("errors.error_fetching_data", { ns: "common" })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {error instanceof Error
                        ? error.message
                        : "Unknown error occurred"}
                </Typography>
                <Button
                    variant="outlined"
                    onClick={() => window.location.reload()}
                >
                    {t("actions.retry", { ns: "common" })}
                </Button>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                borderRadius: theme.shape.borderRadius,
            }}
        >
            {/* Header Section */}
            <PageHeader
                title="Email Campaign Report"
                description="View and analyze email campaign performance reports"
            />

            {/* Filters Section */}
            <Paper
                sx={{
                    mb: theme.spacing(3),
                    background: "white",
                    borderRadius: theme.shape.borderRadius,
                    boxShadow: theme.shadows[1],
                    border: "1px solid",
                    borderColor: "divider",
                }}
                elevation={0}
            >
                <Box
                    sx={{
                        p: { xs: 1.5, sm: 2 },
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    <FilterIcon
                        sx={{
                            color: "primary.main",
                            fontSize: { xs: 18, sm: 20 },
                        }}
                    />
                    <Typography
                        variant="subtitle1"
                        sx={{
                            fontWeight: 500,
                            fontSize: { xs: "0.875rem", sm: "1rem" },
                        }}
                    >
                        Filters
                    </Typography>
                </Box>
                <Box sx={{ p: { xs: 2, sm: 3 } }}>
                    <Grid container spacing={3} alignItems="end">
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Start Date"
                                type="date"
                                value={filters.startDate}
                                onChange={(e) =>
                                    handleFilterChange(
                                        "startDate",
                                        e.target.value
                                    )
                                }
                                InputLabelProps={{ shrink: true }}
                                sx={{
                                    "& .MuiInputBase-root": {
                                        height: "40px",
                                    },
                                }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <TextField
                                fullWidth
                                size="small"
                                label="End Date"
                                type="date"
                                value={filters.endDate}
                                onChange={(e) =>
                                    handleFilterChange(
                                        "endDate",
                                        e.target.value
                                    )
                                }
                                InputLabelProps={{ shrink: true }}
                                sx={{
                                    "& .MuiInputBase-root": {
                                        height: "40px",
                                    },
                                }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <Autocomplete
                                options={
                                    Array.isArray(customers) ? customers : []
                                }
                                getOptionLabel={(option: any) =>
                                    option?.name || ""
                                }
                                isOptionEqualToValue={(option, value) =>
                                    option.id === value.id
                                }
                                value={
                                    (Array.isArray(customers)
                                        ? customers.find(
                                            (c) =>
                                                String(c.id) ===
                                                filters.accountId
                                        )
                                        : null) || null
                                }
                                onChange={(e, newValue: any | null) =>
                                    handleFilterChange(
                                        "accountId",
                                        newValue ? String(newValue.id) : ""
                                    )
                                }
                                loading={customersLoading}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Customer"
                                        size="small"
                                        InputLabelProps={{ shrink: true }}
                                        sx={{
                                            "& .MuiInputBase-root": {
                                                height: "40px",
                                            },
                                        }}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Communication Channel</InputLabel>
                                <Select
                                    value={filters.emailType}
                                    label="Communication Channel"
                                    onChange={(e) =>
                                        handleFilterChange(
                                            "emailType",
                                            e.target.value
                                        )
                                    }
                                    sx={{
                                        "& .MuiInputBase-root": {
                                            height: "40px",
                                        },
                                    }}
                                >
                                    {activityCategories.map((category) => (
                                        <MenuItem
                                            key={category.value}
                                            value={category.value}
                                        >
                                            {category.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 12, md: 4 }}>
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 2,
                                    justifyContent: {
                                        xs: "stretch",
                                        md: "flex-end",
                                    },
                                    alignItems: "end",
                                }}
                            >
                                <Button
                                    variant="contained"
                                    onClick={() => refetch()}
                                    size="small"
                                    sx={{
                                        textTransform: "none",
                                        fontWeight: 500,
                                        minWidth: { xs: "auto", sm: "100px" },
                                        height: "40px",
                                    }}
                                >
                                    Refresh
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            {/* Summary Statistics */}
            {reportData && reportData.summary && (
                <EmailCampaignSummary
                    summary={reportData.summary}
                    channel={filters.emailType as "Email" | "SMS" | "WhatsApp"}
                />
            )}

            {/* Data Table */}
            {isLoading ? (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "400px",
                    }}
                >
                    <CircularProgress size={40} />
                </Box>
            ) : reportData && reportData.data ? (
                <EmailCampaignReportTable
                    data={reportData.data}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                    channel={filters.emailType as "Email" | "SMS" | "WhatsApp"}
                />
            ) : null}
        </Box>
    );
};

export default EmailCampaignReportContainer;
