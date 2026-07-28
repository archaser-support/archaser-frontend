import { apiFetch } from "@/utils/apiFetch";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import {
    Box,
    Button,
    CircularProgress,
    IconButton,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { Country } from "countries-and-timezones";
import moment from "moment";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import NoRecordsOverlay from "@/shared/components/NoRecordsOverlay";
import EndlessScrollDataGrid, {
    BREAKPOINTS,
    useWindowWidth,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { fetchAgentsWithFollowUpCall } from "@/shared/services/agentService";
import { ExportFormat } from "@/shared/utility/exportToExcel";
import { CustomerAgent } from "@/types/CustomerWithAgentDispute";
import AppUrls from "@/utils/appUrls";
import { formatCallOutcome } from "@/utils/callFormatters";
import {
    formatDateForDisplay,
    getCountryTimezone,
    getCurrentTimeForCountry,
} from "@/utils/datetimeOperations";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";
import { translateStoredI18nKey } from "@/shared/utils/resolveI18nPlaceholders";

const rowsPerPage = 5;

const formatLastCallResult = (lastCallResult: string | null, t: any) => {
    if (!lastCallResult) return null;

    if (lastCallResult.startsWith("{{") && lastCallResult.endsWith("}}")) {
        const translated = translateStoredI18nKey(lastCallResult, t);
        if (
            translated &&
            translated !== lastCallResult &&
            !translated.startsWith("{{")
        ) {
            return translated;
        }
        const translationKey = lastCallResult.slice(2, -2);
        const outcomeMatch = translationKey.match(
            /activities?\.values\.outcomes_(.+)/
        );
        if (outcomeMatch) {
            const outcomeValue = outcomeMatch[1];
            return outcomeValue
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase());
        }
        return translationKey;
    }

    // Legacy TRANSLATE: prefix support (for backward compatibility during migration)
    if (lastCallResult.startsWith("TRANSLATE:")) {
        const translationKey = lastCallResult.replace("TRANSLATE:", "");
        // Convert TRANSLATE:activity.outcomes.XXX to {{activities.values.outcomes_XXX}}
        const outcomeMatch = translationKey.match(/activity\.outcomes\.(.+)/);
        if (outcomeMatch) {
            const outcomeValue = outcomeMatch[1];
            const translation = t(`values.outcomes_${outcomeValue}`, {
                ns: "activities",
            });
            // Check if translation was found
            if (translation && !translation.startsWith("values.outcomes_")) {
                return translation;
            }
            // Fallback: format the outcome value nicely
            return outcomeValue
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase());
        }
        return t(translationKey);
    }

    // Fallback: return as-is (legacy values)
    return lastCallResult;
};

const FollowUpList: React.FC = () => {
    const { t, i18n } = useTranslation(["agents", "common", "activities"]);
    const theme = useTheme();
    const { showToast } = useToast();
    const router = useRouter();
    const { data: session } = useSession();
    const windowWidth = useWindowWidth();

    const [selectedCountry, _setSelectedCountry] = useState<Country | null>(
        null
    );
    const [_currentPage, setCurrentPage] = useState<number>(1);
    const [searchQuery, _setSearchQuery] = useState<string>("");

    // React Query to fetch follow-up agents
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: [
            "agentsWithFollowUpCall",
            {
                search: searchQuery,
                page: _currentPage,
                limit: rowsPerPage,
                country: selectedCountry?.name || "",
                sortField: "last_call",
                sortDirection: "desc",
            },
        ],
        queryFn: fetchAgentsWithFollowUpCall,
        refetchOnWindowFocus: false,
    });

    // Export handler for follow-up agents (must be declared before any conditional return)
    const _handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            try {
                // Make API call to fetch ALL records for export (not just loaded ones)
                const params = new URLSearchParams({
                    search: searchQuery,
                    country: selectedCountry?.name || "",
                    export: "true", // Flag to indicate this is an export request
                    limit: "10000", // Large limit to get all data
                });

                const response = await apiFetch(`/api/system/agents/follow-up?${params.toString()}`
                );
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const rawAgents = data.agents || [];

                const transformedAgents = rawAgents.map(
                    (agent: CustomerAgent) => {
                        const country =
                            agent.Customer?.Country?.name ??
                            t("fields.unknown");
                        const customerName = agent.Customer?.Person
                            ? `${agent.Customer.Person.first_name} ${agent.Customer.Person.last_name}`
                            : agent.Customer?.Company?.name ||
                            t("fields.unknown");

                        const customerNumber =
                            agent.Customer?.customer_number ||
                            t("fields.unknown");
                        const amountOverdue =
                            agent?.total_outstanding_amount ?? 0;
                        const currency = agent?.currency || "";

                        // Calculate days past due - simplified for follow-up list
                        const _daysPastDue = t("values.days_overdue_n_a", {
                            ns: "disputes",
                        });

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
                            ? formatCallOutcome(agent.last_call_result)
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
                            amount_overdue:
                                amountOverdue === 0
                                    ? `0.00 ${currency}`
                                    : `${formatAmountWithoutSymbol(amountOverdue)} ${currency}`,
                            customer_country: country,
                            customer_current_time: t("fields.unknown"), // This would need timezone calculation
                            last_call: lastCallDate,
                            last_call_result: lastCallResult,
                            follow_up_time: followUpTime,
                            raw: agent,
                        };
                    }
                );

                return transformedAgents;
            } catch (_error) {
                console.error("Export failed:", _error);
                throw _error;
            }
        },
        [searchQuery, selectedCountry, t, session]
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

    const agents = data?.agents || [];
    const totalRecords = data?.totalRecords || 0;
    const _totalPages = Math.ceil(totalRecords / rowsPerPage);

    if (isLoading) {
        return (
            <Box sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    {t("fields.follow_up_list")}
                </Typography>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    {t("sections.follow_up_description")}
                </Typography>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        py: 4,
                    }}
                >
                    <Box sx={{ textAlign: "center" }}>
                        <CircularProgress color="primary" size={40} />
                    </Box>
                </Box>
            </Box>
        );
    }

    if (totalRecords === 0) {
        return (
            <Box
                sx={{
                    p: 1,
                    mb: 3,
                    animation: "slideUpFollowUp 0.8s ease-out 0.4s forwards",
                    opacity: 0,
                    transform: "translateY(20px)",
                    "@keyframes slideUpFollowUp": {
                        "0%": {
                            opacity: 0,
                            transform: "translateY(20px)",
                        },
                        "100%": {
                            opacity: 1,
                            transform: "translateY(0)",
                        },
                    },
                }}
            >
                <Typography variant="h6" sx={{ mb: 0, fontWeight: 600 }}>
                    {t("fields.follow_up_list")}
                </Typography>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                >
                    {t("sections.follow_up_description")}
                </Typography>
                <Box sx={{ py: 0.25 }}>
                    <NoRecordsOverlay
                        icon={CalendarTodayIcon}
                        title={t("fields.no_follow_ups_scheduled")}
                        description={t("messages.no_follow_ups_description")}
                        iconColor="secondary"
                        sx={{
                            "& .MuiTypography-root": {
                                maxWidth: "600px",
                                textAlign: "center",
                            },
                            "& .MuiSvgIcon-root": {
                                width: "20px",
                                height: "20px",
                            },
                            // Override the main container padding
                            py: "8px !important",
                            px: "8px !important",
                            mt: "0 !important",
                            // Override the inner box gap and icon margin
                            "& > div > div": {
                                gap: "4px !important",
                                "& > div:first-of-type": {
                                    mb: "4px !important",
                                },
                            },
                        }}
                    />
                </Box>
            </Box>
        );
    }

    const columns: GridColDef[] = [
        {
            field: "customer",
            headerName: t("fields.customer"),
            flex: 1,
            renderCell: (params: GridRenderCellParams) =>
                formatData(params.row, "customer"),
        },
        {
            field: "amount_overdue",
            headerName: t("fields.amount_overdue", { ns: "agents" }),
            flex: 1,
            renderCell: (params: GridRenderCellParams) =>
                formatData(params.row, "amount_overdue"),
        },
        {
            field: "customer_country",
            headerName: t("fields.customer_country"),
            flex: 1,
            renderCell: (params: GridRenderCellParams) =>
                formatData(params.row, "customer_country"),
        },
        {
            field: "customer_current_time",
            headerName: t("fields.customer_current_time"),
            flex: 1,
            renderCell: (params: GridRenderCellParams) =>
                formatData(params.row, "customer_current_time"),
        },
        {
            field: "last_call",
            headerName: t("fields.last_call"),
            flex: 1,
            renderCell: (params: GridRenderCellParams) =>
                formatData(params.row, "last_call"),
        },
        {
            field: "last_call_result",
            headerName: t("fields.last_call_result"),
            width: 150,
            renderCell: (params) => {
                const formattedResult = formatLastCallResult(
                    params.row.last_call_result,
                    t
                );
                return (
                    <Typography variant="body2">
                        {formattedResult || "-"}
                    </Typography>
                );
            },
        },
        {
            field: "follow_up_time",
            headerName: t("fields.log_activity_follow_up_time", {
                ns: "activities",
            }),
            flex: 1,
            renderCell: (params: GridRenderCellParams) =>
                formatData(params.row, "follow_up_time"),
        },
        {
            field: "actions",
            headerName: t("actions.actions", { ns: "common" }),
            flex: 0.5,
            renderCell: (params: GridRenderCellParams) => (
                <Tooltip title={t("fields.clear_follow_up_time")}>
                    <IconButton
                        size="small"
                        onClick={() => clearFollowUpTime(params.row?.id)}
                        color="primary"
                    >
                        <RemoveCircleOutlineIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ),
        },
    ];

    const formatData = (row: CustomerAgent, key: string) => {
        switch (key) {
            case "customer": {
                // Add null check for row.Customer
                if (!row.Customer) {
                    return (
                        <Typography variant="body2">
                            {t("fields.unknown")}
                        </Typography>
                    );
                }

                const customer_name = row.Customer.Person
                    ? `${row.Customer.Person.first_name} ${row.Customer.Person.last_name}`
                    : row.Customer.Company?.name || t("fields.unknown");
                const isRTL = i18n.language === "he";
                const customerUrl = AppUrls.Customer_ACTIVITY(row.Customer.id);
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
                                router.push(customerUrl);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            sx={{
                                fontWeight: theme.typography.fontWeightMedium,
                                color: theme.palette.primary.main,
                                cursor: "pointer",
                                pointerEvents: "auto",
                                textAlign: isRTL ? "right" : "left",
                                textDecoration: "underline",
                                textUnderlineOffset: "0.125em",
                                "&:hover": {
                                    color: theme.palette.primary.dark,
                                    textDecoration: "underline",
                                },
                            }}
                        >
                            {customer_name}
                        </Typography>
                    </Box>
                );
            }
            case "amount_overdue":
                return (
                    <Typography variant="body2">
                        {formatAmountWithoutSymbol(
                            row?.total_outstanding_amount ?? 0
                        )}
                    </Typography>
                );
            case "customer_country":
                return (
                    <Typography variant="body2">
                        {row.Customer?.Country?.name || t("fields.unknown")}
                    </Typography>
                );
            case "customer_current_time": {
                const country = row.Customer?.Country?.name ?? "Unknown";
                if (country === "Unknown") {
                    return (
                        <Typography variant="body2">
                            {t("fields.unknown")}
                        </Typography>
                    );
                }
                const currentTime = getCurrentTimeForCountry(
                    country,
                    undefined,
                    "en-US",
                    true
                );
                const timezone = getCountryTimezone(country);

                return (
                    <Typography variant="body2">
                        {timezone !== "UTC"
                            ? `${currentTime} (${timezone})`
                            : currentTime}
                    </Typography>
                );
            }
            case "last_call":
                return (
                    <Typography variant="body2">
                        {row.last_call
                            ? formatDateForDisplay(
                                row.last_call,
                                "datetime",
                                session?.user?.locale,
                                session?.user?.timezone
                            )
                            : ""}
                    </Typography>
                );
            case "follow_up_time": {
                const followUpTime = moment(row.follow_up_time);
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
                    <Typography
                        variant="body2"
                        sx={{
                            color,
                            fontWeight,
                            fontSize: "0.875rem",
                        }}
                    >
                        {row.follow_up_time
                            ? formatDateForDisplay(
                                row.follow_up_time,
                                "datetime",
                                session?.user?.locale,
                                session?.user?.timezone
                            )
                            : "-"}
                    </Typography>
                );
            }
            default:
                return <Typography variant="body2">-</Typography>;
        }
    };

    const clearFollowUpTime = async (id: number) => {
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
            showToast(t("messages.status_updated_successfully"), "success");
            refetch();
        } catch (error) {
            showToast((error as Error).message, "error");
        }
    };

    // Transform agents data for DataGrid
    const rows = agents.map((agent, index) => ({
        ...agent,
        id: agent.id || index,
    }));

    return (
        <Box
            sx={{
                mb: 3,
                width: "100%",
                maxWidth: "100%",
                overflow: "hidden",
                animation: "slideUpFollowUp 0.8s ease-out 0.4s forwards",
                opacity: 0,
                transform: "translateY(20px)",
                "@keyframes slideUpFollowUp": {
                    "0%": {
                        opacity: 0,
                        transform: "translateY(20px)",
                    },
                    "100%": {
                        opacity: 1,
                        transform: "translateY(0)",
                    },
                },
            }}
        >
            <Box sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                    {t("fields.follow_up_list")}
                </Typography>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                >
                    {t("sections.follow_up_description")} -{" "}
                    {t("fields.scheduled_follow_ups_due_today")}
                </Typography>

                <EndlessScrollDataGrid
                    rows={rows}
                    columns={columns}
                    totalRecords={totalRecords}
                    isLoading={isLoading}
                    onLoadMore={() => { }}
                    hasMore={false}
                    resizableColumns={true}
                    columnVisibilityModel={{
                        customer: windowWidth >= BREAKPOINTS.MOBILE,
                        amount_overdue: windowWidth >= BREAKPOINTS.TABLET,
                        customer_country: windowWidth >= BREAKPOINTS.DESKTOP,
                        customer_current_time:
                            windowWidth >= BREAKPOINTS.DESKTOP,
                        last_call: windowWidth >= BREAKPOINTS.TABLET,
                        follow_up_time: windowWidth >= BREAKPOINTS.TABLET,
                        actions: windowWidth >= BREAKPOINTS.MOBILE,
                    }}
                    noRowsMessage={t("messages.no_results", { ns: "common" })}
                    noRowsDescription={t("messages.try_adjusting_your_filters")}
                />
            </Box>
        </Box>
    );
};

export default FollowUpList;
