"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    Alert,
    Box,
    CircularProgress,
    Typography,
    useMediaQuery,
    useTheme
} from "@mui/material";
import { GridSortModel } from "@mui/x-data-grid";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import EndlessScrollDataGrid, {
    createQueryFn,
    useVirtualInfiniteScroll,
    useWindowWidth
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { ExportFormat } from "@/shared/utility/exportToExcel";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import { shouldUseDashboardActivityReportList } from "@/shared/dashboard/dashboardActivityChartFilters";
import { shouldUseDashboardDisputeReportList } from "@/shared/dashboard/dashboardDisputeChartFilters";
import { shouldUseDashboardPromiseReportList } from "@/shared/dashboard/dashboardPromiseChartFilters";
import AppUrls from "@/utils/appUrls";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

import { OperationDashboardActivityDetailsGrid } from "./OperationDashboardActivityDetailsGrid";
import { OperationDashboardDisputeDetailsGrid } from "./OperationDashboardDisputeDetailsGrid";
import { OperationDashboardPromiseDetailsGrid } from "./OperationDashboardPromiseDetailsGrid";

interface OperationDashboardDetailsProps {
    params: Promise<{ locale: string }>;
}

const OperationDashboardDetailsPage: React.FC<
    OperationDashboardDetailsProps
> = ({ params }) => {
    const resolvedParams = React.use(params);
    const { t, i18n } = useTranslation(
        [
            "dashboard",
            "common",
            "activities",
            "disputes",
            "customers",
            "accounts",
        ],
        {
            lng: resolvedParams.locale,
        }
    );
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const theme = useTheme();
    const windowWidth = useWindowWidth();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const cardType = searchParams?.get("type");
    const startDateParam = searchParams?.get("startDate");
    const endDateParam = searchParams?.get("endDate");
    const selectedUserId = searchParams?.get("selectedUserId");
    const businessUnitIdParam = searchParams?.get("businessUnitId");
    const businessUnitId = businessUnitIdParam
        ? parseInt(businessUnitIdParam, 10)
        : null;

    const useActivityReportList = shouldUseDashboardActivityReportList({
        type: cardType || "",
        startDate: startDateParam,
        endDate: endDateParam,
    });
    const useDisputeReportList = shouldUseDashboardDisputeReportList({
        type: cardType || "",
        startDate: startDateParam,
        endDate: endDateParam,
    });
    const usePromiseReportList = shouldUseDashboardPromiseReportList({
        type: cardType || "",
        startDate: startDateParam,
        endDate: endDateParam,
    });
    const useReportList =
        useActivityReportList || useDisputeReportList || usePromiseReportList;

    const [searchValue, setSearchValue] = useState("");
    const [debouncedSearch] = useDebounce(searchValue, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([]);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const prevCardTypeRef = useRef(cardType);
    const prevStartDateRef = useRef(startDateParam);
    const prevEndDateRef = useRef(endDateParam);
    const prevSelectedUserIdRef = useRef(selectedUserId);
    const prevBusinessUnitIdRef = useRef(businessUnitIdParam);

    // Get user locale and timezone for date formatting
    const userLocale = getUserDateLocale(session);
    const userTimezone = getUserTimezone(session);

    // Extract sort field and direction
    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort;

    // Create query key
    const queryKey = useMemo(
        () => [
            "operationDashboardDetails",
            {
                cardType,
                startDateParam,
                endDateParam,
                selectedUserId,
                businessUnitId: businessUnitIdParam,
                search: debouncedSearch,
                sortField,
                sortDirection,
                version: queryKeyVersion,
            },
        ],
        [
            cardType,
            startDateParam,
            endDateParam,
            selectedUserId,
            businessUnitIdParam,
            debouncedSearch,
            sortField,
            sortDirection,
            queryKeyVersion,
        ]
    );

    // Create query function for virtual infinite scroll
    const queryFn = useMemo(
        () =>
            createQueryFn(
                "/api/system/operation-dashboard/details",
                {
                    type: cardType || "",
                    startDate: startDateParam || "",
                    endDate: endDateParam || "",
                    selectedUserId: selectedUserId || "",
                    businessUnitId: businessUnitIdParam || "",
                    search: debouncedSearch, // Pass directly - createQueryFn will filter out empty strings
                    sortBy: sortField || "",
                    sortOrder: sortDirection || "asc",
                },
                "data"
            ),
        [
            cardType,
            startDateParam,
            endDateParam,
            selectedUserId,
            businessUnitIdParam,
            debouncedSearch,
            sortField,
            sortDirection,
        ]
    );

    // Use virtual infinite scroll hook (legacy path only)
    const {
        data: detailsData,
        totalRecords,
        isLoading,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll({
        queryKey:
            cardType && !useReportList
                ? queryKey
                : ["operationDashboardDetails", "disabled"],
        queryFn:
            cardType && !useReportList
                ? queryFn
                : async () => ({ data: [], totalRecords: 0, hasMore: false }),
    });

    // Reset when search/filter changes (but not for sort changes) — legacy path only
    React.useEffect(() => {
        if (useReportList) {
            return;
        }
        // Only reset if the values actually changed
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;
        const cardTypeChanged = prevCardTypeRef.current !== cardType;
        const startDateChanged = prevStartDateRef.current !== startDateParam;
        const endDateChanged = prevEndDateRef.current !== endDateParam;
        const selectedUserIdChanged =
            prevSelectedUserIdRef.current !== selectedUserId;
        const businessUnitIdChanged =
            prevBusinessUnitIdRef.current !== businessUnitIdParam;

        if (
            searchChanged ||
            cardTypeChanged ||
            startDateChanged ||
            endDateChanged ||
            selectedUserIdChanged ||
            businessUnitIdChanged
        ) {
            prevDebouncedSearchRef.current = debouncedSearch;
            prevCardTypeRef.current = cardType;
            prevStartDateRef.current = startDateParam;
            prevEndDateRef.current = endDateParam;
            prevSelectedUserIdRef.current = selectedUserId;
            prevBusinessUnitIdRef.current = businessUnitIdParam;

            // Increment version to force new query
            setQueryKeyVersion((prev) => prev + 1);

            // Reset immediately when search or filter changes
            // Note: reset() uses queryKey from hook's closure, which will be updated
            // when queryKey changes due to the version increment above
            reset();
        }
    }, [
        useReportList,
        debouncedSearch,
        cardType,
        startDateParam,
        endDateParam,
        selectedUserId,
        businessUnitIdParam,
        reset,
    ]);

    // Export handler - fetches all data from API (matches CustomerList/ViewBasedDataGrid pattern)
    const handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            const params = appendDashboardBusinessUnitId(
                new URLSearchParams({
                    type: cardType || "",
                    startDate: startDateParam || "",
                    endDate: endDateParam || "",
                    selectedUserId: selectedUserId || "",
                    search: debouncedSearch,
                    sortBy: sortField || "",
                    sortOrder: sortDirection || "asc",
                    page: "1",
                    limit: "10000",
                }),
                businessUnitId
            );

            const response = await apiFetch(`/api/system/operation-dashboard/details?${params.toString()}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.data || [];
        },
        [
            cardType,
            startDateParam,
            endDateParam,
            selectedUserId,
            businessUnitId,
            debouncedSearch,
            sortField,
            sortDirection,
        ]
    );

    // Helper function to translate values that might be in brackets or raw translation keys
    const translateValue = (val: string): string => {
        if (!val) return "-";

        // Handle common raw values that should be translated
        const lowVal = String(val).toLowerCase();
        if (lowVal === "portal_user" || lowVal === "portal") {
            return t("values.portal_user", { ns: "users", defaultValue: t("portal", { ns: "activities", defaultValue: "Portal" }) });
        }
        if (lowVal === "system" || lowVal === "system_user" || lowVal === "system user") {
            return t("system", { ns: "activities", defaultValue: "System" });
        }

        let key = val;
        let isBracketed = false;
        if (typeof val === "string" && val.startsWith("{{") && val.endsWith("}}")) {
            key = val.slice(2, -2);
            isBracketed = true;
        }

        // Namespaced i18n keys (e.g. customers.values.category_dispute). Activity payloads sometimes use
        // spaces where JSON/storage used underscores ("category dispute"); normalize before lookup.
        if (typeof key === "string" && key.includes(".") && !key.includes("<")) {
            const keyForNsLookup = key.replace(/\s+/g, "_");
            if (!keyForNsLookup.includes(" ")) {
                const parts = keyForNsLookup.split(".");
                if (parts.length >= 2) {
                    const ns = parts[0];
                    const actualKey = parts.slice(1).join(".");
                    const translated = t(actualKey, {
                        ns,
                        defaultValue: "___NOT_FOUND___",
                    });
                    if (translated !== "___NOT_FOUND___") {
                        return translated as string;
                    }
                }
            }
        }

        if (isBracketed) {
            return t(key, { ns: "activities" }) as string;
        }

        return val;
    };

    // Helper function to translate activity titles
    const translateTitle = (title: string, params: any): string => {
        if (!title) return "-";
        if (
            typeof title === "string" &&
            title.startsWith("{{") &&
            title.endsWith("}}")
        ) {
            const keyWithBrackets = title;
            const key = keyWithBrackets.slice(2, -2);
            const titleParams = { ...(params.row.title_params || {}) };

            // Handle userId replacement - favor agent_name if available and titleParams.userId looks like a UUID or is portal_user/system
            if (params.row.agent_name && params.row.agent_name !== "Unknown") {
                const currentUserId = String(titleParams.userId || "").toLowerCase();
                const isUuid =
                    currentUserId.includes("-") &&
                    currentUserId.length > 20;

                const isSystemOrPortal =
                    currentUserId === "portal_user" ||
                    currentUserId === "system" ||
                    currentUserId === "system_user";

                if (!titleParams.userId || isUuid || isSystemOrPortal) {
                    titleParams.userId = translateValue(params.row.agent_name);
                }
            }

            // Handle other common parameters that might need translation
            ["callType", "outcome", "reason", "oldCategory", "newCategory"].forEach((p) => {
                if (titleParams[p]) {
                    titleParams[p] = translateValue(titleParams[p]);
                }
            });

            // Handle resolution specially
            if (titleParams.resolution) {
                const resolutionKey = `values.dispute_resolution_${String(titleParams.resolution).toLowerCase().replace(/[_\s]/g, "_")}`;
                titleParams.resolution = t(resolutionKey, {
                    ns: "disputes",
                    defaultValue: translateValue(titleParams.resolution)
                });
            }

            // Check if it's a namespaced key (e.g., disputes.fields.filed_portal_title)
            if (key.includes(".") && key.split(".").length >= 3) {
                const parts = key.split(".");
                const ns = parts[0];
                const actualKey = parts.slice(1).join(".");
                return t(actualKey, { ns, ...titleParams }) as string;
            }

            // Default to 'activities' namespace if not specified
            return t(key, { ns: "activities", ...titleParams }) as string;
        }
        return title;
    };

    // Helper function to create date cell renderer
    const createDateCell = (format: "date" | "datetime") => {
        return (params: any) => {
            if (!params.value) return "";
            return (
                <Typography variant="body2">
                    {formatDateForDisplay(
                        params.value,
                        format,
                        userLocale,
                        userTimezone
                    )}
                </Typography>
            );
        };
    };

    // Get card title
    const getCardTitle = (type: string | null) => {
        if (!type) return "";
        const titles: Record<string, string> = {
            "manual-activities": t("fields.manual_activities", {
                ns: "activities",
            }),
            "automated-activities": t("fields.automated_activities", {
                ns: "activities",
            }),
            "total-calls": t("fields.total_calls", { ns: "activities" }),
            "activity-success-rate": t("fields.activity_success_rate", {
                ns: "activities",
            }),
            "disputes-created": t("fields.disputes_created", {
                ns: "disputes",
            }),
            "disputes-closed": t("fields.disputes_closed", { ns: "disputes" }),
            "open-disputes": t("fields.open_disputes", { ns: "disputes" }),
            "promises-to-pay": t("fields.promises_to_pay", {
                ns: "dashboard",
            }),
            "undelivered-activities": t("fields.undelivered_activities", {
                ns: "activities",
            }),
            "overdue-follow-ups": t("fields.overdue_follow_ups", {
                ns: "activities",
            }),
            "automation-stuck": t("fields.automation_stuck", {
                ns: "activities",
            }),
            "system-activities": t("fields.system_activities", {
                ns: "activities",
            }),
            "portal-activities": t("fields.portal_activities", {
                ns: "activities",
            }),
        };
        return titles[type] || type;
    };

    // Format date range for display
    const formattedDateRange = useMemo(() => {
        if (!startDateParam || !endDateParam) return null;

        try {
            const start = formatDateForDisplay(
                startDateParam,
                "date",
                userLocale,
                userTimezone
            );
            const end = formatDateForDisplay(
                endDateParam,
                "date",
                userLocale,
                userTimezone
            );
            return `${start} - ${end}`;
        } catch {
            return null;
        }
    }, [startDateParam, endDateParam, userLocale, userTimezone]);

    // Get selected user name (would need to fetch from API in real implementation)
    const selectedUserName = null;

    // Column definitions based on card type
    const columns = useMemo(() => {
        const baseColumns = [
            {
                field: "customer_name",
                headerName: t("fields.name", { ns: "customers" }),
                flex: 1,
                minWidth: 200,
                renderCell: (params: any) => {
                    const customerId = params.row.customer_id;
                    if (!customerId) {
                        return (
                            <Typography variant="body2">
                                {params.value}
                            </Typography>
                        );
                    }
                    return (
                        <Box
                            component={Link}
                            href={AppUrls.Customer_DETAILS(customerId)}
                            sx={{
                                color: theme.palette.secondary.main,
                                textDecoration: "underline",
                                textUnderlineOffset: "0.125em",
                                fontWeight: 500,
                                cursor: "pointer",
                                "&:hover": {
                                    textDecoration: "underline",
                                    color: theme.palette.secondary.dark,
                                },
                            }}
                        >
                            {params.value}
                        </Box>
                    );
                },
            },
            {
                field: "customer_number",
                headerName: t("fields.customer_number", { ns: "customers" }),
                width: 150,
            },
        ];

        const titleColumn = {
            field: "title",
            headerName: t("fields.title", { ns: "activities" }),
            width: 450,
            renderCell: (params: any) => {
                const translatedHtml = translateTitle(params.value, params);
                const plainText = translatedHtml.replace(/<[^>]+>/g, "");
                return (
                    <Typography
                        variant="body2"
                        component="div"
                        {...({ text: plainText } as any)}
                        sx={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            width: "100%",
                        }}
                        dangerouslySetInnerHTML={{
                            __html: translatedHtml,
                        }}
                    />
                );
            },
        };

        switch (cardType) {
            case "automated-activities":
                return [
                    ...baseColumns,
                    {
                        field: "agent_name",
                        headerName: t("fields.created_by", { ns: "common" }),
                        width: 200,
                        renderCell: (params: any) => (
                            <Typography variant="body2">
                                {translateValue(params.value)}
                            </Typography>
                        ),
                    },
                    titleColumn,
                    {
                        field: "status",
                        headerName: t("fields.status", { ns: "common" }),
                        width: 120,
                        renderCell: (params: any) => {
                            const status = params.value;
                            if (!status) return "-";
                            const statusMap: Record<string, string> = {
                                DELIVERED: t("values.status_delivered", {
                                    ns: "activities",
                                }),
                                COMPLETED: t("values.status_completed", {
                                    ns: "activities",
                                }),
                                SENT: t("values.status_sent", {
                                    ns: "activities",
                                }),
                                SCHEDULED: t("values.status_scheduled", {
                                    ns: "activities",
                                }),
                                FAILED: t("values.status_failed", {
                                    ns: "activities",
                                }),
                                BOUNCED: t("values.status_bounced", {
                                    ns: "activities",
                                }),
                                CANCELLED: t("values.status_cancelled", {
                                    ns: "activities",
                                }),
                                DISPUTE: t("values.status_dispute", {
                                    ns: "activities",
                                }),
                                PAUSED: t("values.status_paused", {
                                    ns: "activities",
                                }),
                            };
                            return (
                                <Typography variant="body2">
                                    {statusMap[status] || status}
                                </Typography>
                            );
                        },
                    },
                    {
                        field: "type",
                        headerName: t("fields.type", { ns: "activities" }),
                        width: 120,
                        renderCell: (params: any) => {
                            const type = params.value;
                            if (!type) return "-";
                            const typeMap: Record<string, string> = {
                                SMS: t("values.sms", { ns: "activities" }),
                                Email: t("values.email", { ns: "activities" }),
                                Call: t("values.filter_types_call", {
                                    ns: "activities",
                                }),
                                WhatsApp: t("values.whatsapp", {
                                    ns: "activities",
                                }),
                                Internal: t("values.filter_types_internal", {
                                    ns: "activities",
                                }),
                                Dispute: t("values.filter_types_dispute", {
                                    ns: "activities",
                                }),
                                Promise_to_pay: t(
                                    "values.filter_types_promise_to_pay",
                                    { ns: "activities" }
                                ),
                            };
                            return (
                                <Typography variant="body2">
                                    {typeMap[type] || type}
                                </Typography>
                            );
                        },
                    },
                    {
                        field: "created_at",
                        headerName: t("fields.created_at", { ns: "common" }),
                        width: 180,
                        renderCell: createDateCell("date"),
                    },
                ];

            case "undelivered-activities":
            case "overdue-follow-ups":
                return [
                    ...baseColumns,
                    {
                        field: "agent_name",
                        headerName: t("fields.created_by", { ns: "common" }),
                        width: 200,
                        renderCell: (params: any) => (
                            <Typography variant="body2">
                                {translateValue(params.value)}
                            </Typography>
                        ),
                    },
                    titleColumn,
                    {
                        field: "status",
                        headerName: t("fields.status", { ns: "common" }),
                        width: 120,
                        renderCell: (params: any) => {
                            const status = params.value;
                            if (!status) return "-";
                            const statusMap: Record<string, string> = {
                                DELIVERED: t("values.status_delivered", {
                                    ns: "activities",
                                }),
                                COMPLETED: t("values.status_completed", {
                                    ns: "activities",
                                }),
                                SENT: t("values.status_sent", {
                                    ns: "activities",
                                }),
                                SCHEDULED: t("values.status_scheduled", {
                                    ns: "activities",
                                }),
                                FAILED: t("values.status_failed", {
                                    ns: "activities",
                                }),
                                BOUNCED: t("values.status_bounced", {
                                    ns: "activities",
                                }),
                                CANCELLED: t("values.status_cancelled", {
                                    ns: "activities",
                                }),
                                PAUSED: t("values.status_paused", {
                                    ns: "activities",
                                }),
                            };
                            return (
                                <Typography variant="body2">
                                    {statusMap[status] || status}
                                </Typography>
                            );
                        },
                    },
                    {
                        field: "created_at",
                        headerName: t("fields.created_at", { ns: "common" }),
                        width: 180,
                        renderCell: createDateCell("date"),
                    },
                ];

            case "open-disputes":
                return [
                    ...baseColumns,
                    {
                        field: "agent_name",
                        headerName: t("fields.search_and_filters_assignee", {
                            ns: "disputes",
                        }),
                        width: 200,
                        renderCell: (params: any) => (
                            <Typography variant="body2">
                                {translateValue(params.value)}
                            </Typography>
                        ),
                    },
                    {
                        field: "dispute_status",
                        headerName: t("fields.status", { ns: "common" }),
                        width: 150,
                        renderCell: (params: any) => {
                            const status = params.value;
                            if (!status) return "-";
                            // Map status to translation key (e.g., New -> dispute_status_new)
                            const statusKey = `values.dispute_status_${status.toLowerCase().replace(/[_\s]/g, "_")}`;
                            return (
                                <Typography variant="body2">
                                    {t(statusKey, {
                                        ns: "disputes",
                                        defaultValue: status,
                                    })}
                                </Typography>
                            );
                        },
                    },
                    {
                        field: "dispute_reason",
                        headerName: t("fields.reason", { ns: "disputes" }),
                        width: 200,
                    },
                    {
                        field: "created_at",
                        headerName: t("fields.created_at", { ns: "common" }),
                        width: 180,
                        renderCell: createDateCell("date"),
                    },
                ];

            default:
                return baseColumns;
        }
    }, [cardType, t, theme, i18n.language, userLocale, userTimezone]);

    if (!cardType) {
        return (
            <InternalPageWrapper>
                <Alert severity="error">
                    {t("messages.missing_required_parameter", {
                        ns: "common",
                    })}
                </Alert>
            </InternalPageWrapper>
        );
    }

    if (error && !useReportList) {
        return (
            <InternalPageWrapper>
                <Alert severity="error">
                    {error instanceof Error
                        ? error.message
                        : "Unknown error occurred"}
                </Alert>
            </InternalPageWrapper>
        );
    }

    return (
        <InternalPageWrapper>
            <Box
                sx={{
                    bgcolor: "background.default",
                    borderRadius: theme.shape.borderRadius,
                }}
            >
                <PageHeader
                    flushHorizontal
                    title={
                        <Box>
                            <Typography
                                variant={
                                    i18n.language === "he"
                                        ? "hebrewTitle"
                                        : "h5"
                                }
                                sx={{
                                    fontSize: theme.typography.h5.fontSize,
                                    fontWeight: theme.typography.fontWeightBold,
                                    mb:
                                        selectedUserName || formattedDateRange
                                            ? 0.75
                                            : 0,
                                }}
                            >
                                {getCardTitle(cardType)}
                            </Typography>
                            {(selectedUserName || formattedDateRange) && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 1.5,
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        mt: 0.5,
                                    }}
                                >
                                    {selectedUserName && (
                                        <Typography variant="body2">
                                            {t("fields.created_by", {
                                                ns: "common",
                                            })}
                                            : {selectedUserName}
                                        </Typography>
                                    )}
                                    {formattedDateRange && (
                                        <Typography variant="body2">
                                            {t("fields.date_range_preset", {
                                                ns: "dashboard",
                                            })}
                                            : {formattedDateRange}
                                        </Typography>
                                    )}
                                </Box>
                            )}
                        </Box>
                    }
                />
                <Box>
                    {useActivityReportList ? (
                        <OperationDashboardActivityDetailsGrid
                            drillType={cardType}
                            startDate={startDateParam}
                            endDate={endDateParam}
                            businessUnitId={
                                businessUnitId != null &&
                                !Number.isNaN(businessUnitId)
                                    ? businessUnitId
                                    : null
                            }
                            selectedUserId={selectedUserId}
                            searchValue={searchValue}
                            onSearchChange={setSearchValue}
                        />
                    ) : useDisputeReportList ? (
                        <OperationDashboardDisputeDetailsGrid
                            drillType={cardType}
                            startDate={startDateParam}
                            endDate={endDateParam}
                            businessUnitId={
                                businessUnitId != null &&
                                !Number.isNaN(businessUnitId)
                                    ? businessUnitId
                                    : null
                            }
                            selectedUserId={selectedUserId}
                            searchValue={searchValue}
                            onSearchChange={setSearchValue}
                        />
                    ) : usePromiseReportList ? (
                        <OperationDashboardPromiseDetailsGrid
                            drillType={cardType}
                            startDate={startDateParam}
                            endDate={endDateParam}
                            businessUnitId={
                                businessUnitId != null &&
                                !Number.isNaN(businessUnitId)
                                    ? businessUnitId
                                    : null
                            }
                            selectedUserId={selectedUserId}
                            searchValue={searchValue}
                            onSearchChange={setSearchValue}
                        />
                    ) : isLoading && detailsData?.length === 0 ? (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                minHeight: "400px",
                            }}
                        >
                            <CircularProgress color="primary" />
                        </Box>
                    ) : (
                        <EndlessScrollDataGrid
                            rows={detailsData || []}
                            columns={columns}
                            totalRecords={totalRecords}
                            isLoading={isLoading}
                            onLoadMore={loadMore}
                            hasMore={hasMore}
                            sortModel={sortModel}
                            onSortModelChange={setSortModel}
                            searchValue={searchValue}
                            onSearchChange={setSearchValue}
                            searchPlaceholder={t("fields.search_placeholder", {
                                ns: "common",
                            })}
                            searchDebounceMs={500}
                            searchDisabled={false}
                            searchDirection={
                                i18n.language === "he" ? "rtl" : "ltr"
                            }
                            language={i18n.language}
                            fillViewport={true}
                            resizableColumns={true}
                            noRowsMessage={t("messages.no_results", {
                                ns: "common",
                            })}
                            noRowsDescription={t(
                                "messages.no_results_description",
                                { ns: "common" }
                            )}
                            onExport={handleExport}
                            exportDisabled={false}
                            exportContextInfo={{
                                pageName: getCardTitle(cardType),
                                customPrefix: `operation_dashboard_${cardType || "details"}`,
                            }}
                        />
                    )}
                </Box>
            </Box>
        </InternalPageWrapper>
    );
};

export default OperationDashboardDetailsPage;
