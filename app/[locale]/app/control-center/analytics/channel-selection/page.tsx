"use client";
import { apiFetch } from "@/utils/apiFetch";

import { AnalyticsOutlined as AnalyticsOutlinedIcon } from "@mui/icons-material";
import {
    Box,
    Typography,
    Card,
    CardContent,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    CircularProgress,
    Alert,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridColDef } from "@mui/x-data-grid";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { activity_type } from "@prisma/client";
import moment from "moment";
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";

import { getMetricStatCardBorderRadius } from "@/app/theme/metricStatCard";
import { getDatePickerFormat } from "@/utils/datetimeOperations";
import PageHeader from "@/components/PageHeader";
import EndlessScrollDataGrid from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { CurrencyColumnsConfig } from "@/shared/utility/exportToExcel";

interface ChannelMetrics {
    channel: activity_type;
    totalAttempts: number;
    totalSuccesses: number;
    successRate: number;
    averageResponseTime: number;
}

interface AnalyticsData {
    channelMetrics: ChannelMetrics[];
    totalRecords: number;
    period: {
        startDate: string;
        endDate: string;
    };
}

const ChannelSelectionAnalytics: React.FC = () => {
    const theme = useTheme();
    const controlCenterCardSx = useMemo(
        () => ({
            boxShadow: "none" as const,
            borderRadius: getMetricStatCardBorderRadius(theme),
        }),
        [theme]
    );
    const { t, i18n } = useTranslation(["common"]);
    const { data: session } = useSession();
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
        null
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isRTL = i18n.language === "he";

    const datePickerFormat = useMemo(
        () =>
            i18n.language === "he"
                ? "DD/MM/YYYY"
                : getDatePickerFormat(session ?? null, "DD/MM/YYYY"),
        [session, i18n.language]
    );
    const [dateRange, setDateRange] = useState<{
        startDate: moment.Moment | null;
        endDate: moment.Moment | null;
    }>({
        startDate: moment().subtract(30, "days"), // 30 days ago
        endDate: moment(),
    });
    const [selectedChannel, setSelectedChannel] = useState<
        activity_type | "all"
    >("all");
    const [search, setSearch] = useState("");

    const fetchAnalyticsData = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (dateRange.startDate) {
                params.append(
                    "startDate",
                    dateRange.startDate.toDate().toISOString()
                );
            }
            if (dateRange.endDate) {
                params.append(
                    "endDate",
                    dateRange.endDate.toDate().toISOString()
                );
            }
            if (selectedChannel !== "all") {
                params.append("channel", selectedChannel);
            }
            if (search.trim()) {
                params.append("query", search.trim());
            }

            const response = await apiFetch(`/api/communication-intelligence/analytics?${params}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setAnalyticsData(data);
        } catch (err: any) {
            setError(err.message || "Failed to fetch analytics data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalyticsData();
    }, [dateRange, selectedChannel, search]);

    const getChannelDisplayName = (channel: activity_type): string => {
        const channelNames: Record<activity_type, string> = {
            Email: t("values.communication_email"),
            SMS: t("values.communication_sms"),
            Call: t("values.communication_call"),
            WhatsApp: t("values.communication_whatsapp"),
            Internal: t("values.communication_internal"),
            Resolved: t("values.communication_resolved"),
            Dispute: t("values.communication_dispute"),
            Promise_to_pay: t("values.communication_promise_to_pay"),
            Agent: t("values.communication_agent"),
        };
        return channelNames[channel] || channel;
    };

    const getSuccessRateColor = (rate: number): string => {
        if (rate >= 0.8) return theme.palette.success.main;
        if (rate >= 0.6) return theme.palette.warning.main;
        return theme.palette.error.main;
    };

    const formatPercentage = (value: number): string => {
        return `${(value * 100).toFixed(1)}%`;
    };

    const formatHours = (hours: number): string => {
        if (hours < 1) {
            return `${Math.round(hours * 60)}m`;
        }
        if (hours < 24) {
            return `${hours.toFixed(1)}h`;
        }
        return `${(hours / 24).toFixed(1)}d`;
    };

    // Define columns for StyledDataGrid
    const columns: GridColDef[] = [
        {
            field: "channel",
            headerName: t("fields.analytics_table_channel"),
            width: 150,
            renderCell: (params) => (
                <Chip
                    label={getChannelDisplayName(params.value)}
                    sx={{
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                    }}
                />
            ),
        },
        {
            field: "totalAttempts",
            headerName: t("fields.analytics_table_attempts"),
            type: "number",
            width: 120,
            align: "right",
            headerAlign: "right",
        },
        {
            field: "totalSuccesses",
            headerName: t("fields.analytics_table_successes"),
            type: "number",
            width: 120,
            align: "right",
            headerAlign: "right",
        },
        {
            field: "successRate",
            headerName: t("fields.analytics_table_success_rate"),
            type: "number",
            width: 150,
            align: "right",
            headerAlign: "right",
            renderCell: (params) => (
                <Chip
                    label={formatPercentage(params.value)}
                    sx={{
                        backgroundColor: getSuccessRateColor(params.value),
                        color: theme.palette.common.white,
                    }}
                />
            ),
        },
        {
            field: "averageResponseTime",
            headerName: t("fields.analytics_table_avg_response_time"),
            type: "number",
            width: 180,
            align: "right",
            headerAlign: "right",
            renderCell: (params) =>
                params.value > 0 ? formatHours(params.value) : "-",
        },
    ];

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                borderRadius: getMetricStatCardBorderRadius(theme),
                width: "100%",
                maxWidth: "100%",
                overflow: "hidden",
            }}
        >
                {/* Header Section */}
                <PageHeader
                    title={t("sections.channel_selection_analytics_title")}
                    description={t(
                        "fields.channel_selection_analytics_subtitle"
                    )}
                />

                <Box sx={{ p: theme.spacing(3) }}>
                    {/* Filters */}
                    <Card elevation={0} sx={{ mb: 3, ...controlCenterCardSx }}>
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 3,
                                    alignItems: "center",
                                }}
                            >
                                <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
                                    <DatePicker
                                        label={t(
                                            "fields.analytics_filters_start_date"
                                        )}
                                        format={datePickerFormat}
                                        value={dateRange.startDate}
                                        onChange={(date) =>
                                            setDateRange((prev) => ({
                                                ...prev,
                                                startDate:
                                                    date as moment.Moment | null,
                                            }))
                                        }
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                size: "small",
                                                ...(isRTL && {
                                                    "data-hebrew": true,
                                                }),
                                                dir: isRTL ? "rtl" : "ltr",
                                            },
                                        }}
                                    />
                                </Box>
                                <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
                                    <DatePicker
                                        label={t(
                                            "fields.analytics_filters_end_date"
                                        )}
                                        format={datePickerFormat}
                                        value={dateRange.endDate}
                                        onChange={(date) =>
                                            setDateRange((prev) => ({
                                                ...prev,
                                                endDate:
                                                    date as moment.Moment | null,
                                            }))
                                        }
                                        slotProps={{
                                            textField: {
                                                fullWidth: true,
                                                size: "small",
                                                ...(isRTL && {
                                                    "data-hebrew": true,
                                                }),
                                                dir: isRTL ? "rtl" : "ltr",
                                            },
                                        }}
                                    />
                                </Box>
                                <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>
                                            {t(
                                                "fields.analytics_filters_channel"
                                            )}
                                        </InputLabel>
                                        <Select
                                            value={selectedChannel}
                                            onChange={(e) =>
                                                setSelectedChannel(
                                                    e.target.value as
                                                        | activity_type
                                                        | "all"
                                                )
                                            }
                                            label={t(
                                                "fields.analytics_filters_channel"
                                            )}
                                        >
                                            <MenuItem value="all">
                                                {t(
                                                    "fields.analytics_filters_all_channels"
                                                )}
                                            </MenuItem>
                                            <MenuItem value="Email">
                                                {t(
                                                    "values.communication_email"
                                                )}
                                            </MenuItem>
                                            <MenuItem value="SMS">
                                                {t("values.communication_sms")}
                                            </MenuItem>
                                            <MenuItem value="Call">
                                                {t("values.communication_call")}
                                            </MenuItem>
                                            <MenuItem value="WhatsApp">
                                                {t(
                                                    "values.communication_whatsapp"
                                                )}
                                            </MenuItem>
                                            <MenuItem value="Internal">
                                                {t(
                                                    "values.communication_internal"
                                                )}
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Summary Cards */}
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 3,
                            mb: 4,
                        }}
                    >
                        <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
                            <Card elevation={0} sx={controlCenterCardSx}>
                                <CardContent>
                                    <Typography
                                        color="text.secondary"
                                        gutterBottom
                                    >
                                        {t(
                                            "fields.analytics_metrics_total_attempts"
                                        )}
                                    </Typography>
                                    <Typography variant="h4">
                                        {analyticsData?.channelMetrics.reduce(
                                            (sum, metric) =>
                                                sum + metric.totalAttempts,
                                            0
                                        ) || 0}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                        <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
                            <Card elevation={0} sx={controlCenterCardSx}>
                                <CardContent>
                                    <Typography
                                        color="text.secondary"
                                        gutterBottom
                                    >
                                        {t(
                                            "fields.analytics_metrics_total_successes"
                                        )}
                                    </Typography>
                                    <Typography variant="h4">
                                        {analyticsData?.channelMetrics.reduce(
                                            (sum, metric) =>
                                                sum + metric.totalSuccesses,
                                            0
                                        ) || 0}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                        <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
                            <Card elevation={0} sx={controlCenterCardSx}>
                                <CardContent>
                                    <Typography
                                        color="text.secondary"
                                        gutterBottom
                                    >
                                        {t(
                                            "fields.analytics_metrics_overall_success_rate"
                                        )}
                                    </Typography>
                                    <Typography variant="h4">
                                        {analyticsData?.channelMetrics.length
                                            ? formatPercentage(
                                                  analyticsData.channelMetrics.reduce(
                                                      (sum, metric) =>
                                                          sum +
                                                          metric.totalSuccesses,
                                                      0
                                                  ) /
                                                      analyticsData.channelMetrics.reduce(
                                                          (sum, metric) =>
                                                              sum +
                                                              metric.totalAttempts,
                                                          0
                                                      )
                                              )
                                            : "0%"}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                        <Box sx={{ minWidth: 200, flex: "1 1 200px" }}>
                            <Card elevation={0} sx={controlCenterCardSx}>
                                <CardContent>
                                    <Typography
                                        color="text.secondary"
                                        gutterBottom
                                    >
                                        {t(
                                            "fields.analytics_metrics_records_analyzed"
                                        )}
                                    </Typography>
                                    <Typography variant="h4">
                                        {analyticsData?.totalRecords || 0}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                    </Box>

                    {/* Channel Performance DataGrid */}
                    <Box>
                        <EndlessScrollDataGrid
                            rows={analyticsData?.channelMetrics || []}
                            columns={columns}
                            totalRecords={
                                analyticsData?.channelMetrics?.length || 0
                            }
                            isLoading={loading}
                            onLoadMore={() => {}} // No pagination needed for this implementation
                            hasMore={false} // No pagination needed for this implementation
                            language={i18n.language}
                            // Currency columns configuration for export splitting (empty for analytics)
                            currencyColumns={{} as CurrencyColumnsConfig}
                            // Search functionality
                            searchValue={search}
                            onSearchChange={setSearch}
                            searchPlaceholder={t("fields.search_placeholder")}
                            searchDebounceMs={500}
                            searchDisabled={false}
                            searchDirection={
                                i18n.language === "he" ? "rtl" : "ltr"
                            }
                            resizableColumns={true}
                        />
                    </Box>
                </Box>
        </Box>
    );
};

export default ChannelSelectionAnalytics;
