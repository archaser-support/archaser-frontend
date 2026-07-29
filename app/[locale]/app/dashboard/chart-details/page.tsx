"use client";

import {
    AccountBalance as AccountBalanceIcon,
    Group as GroupIcon,
    PersonAdd as PersonAddIcon,
    PersonRemove as PersonRemoveIcon,
    Receipt as ReceiptIcon,
    TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import {
    Alert,
    Box,
    CircularProgress,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { GridSortModel } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";


import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import type { MetricStatCardIconAccent } from "@/app/theme";
import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import {
    COLLECTED_MTD_CHART_TYPE,
    COLLECTED_MTD_CHART_TYPE_LEGACY,
    isCollectedMtdChartType,
} from "@/shared/dashboard/collectedMtdChartDetails";
import {
    appendDashboardBusinessUnitId,
    parseDashboardBusinessUnitIdFromUrl,
} from "@/shared/dashboard/dashboardBusinessUnitParams";
import { shouldUseDashboardCustomerReportList } from "@/shared/dashboard/dashboardCustomerChartFilters";
import { shouldUseDashboardInvoiceReportList } from "@/shared/dashboard/dashboardInvoiceChartFilters";
import { shouldUseDashboardPaymentReportList } from "@/shared/dashboard/dashboardPaymentChartFilters";
import EndlessScrollDataGrid, {
    BREAKPOINTS,
    useWindowWidth,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import {
    CurrencyColumnsConfig,
    ExportFormat,
    formatCurrencyWithCode,
    safeAmount,
} from "@/shared/utility/exportToExcel";
import { apiFetch } from "@/utils/apiFetch";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import {
    formatAmountWithoutSymbol,
    formatCurrencyWithRTLSupport,
    resolveCustomerFirstCurrency,
} from "@/utils/stringFormatters";

import { createColumnDefinitions, getChartColumns } from "./columnDefinitions";
import { DashboardCustomerChartDetailsGrid } from "./DashboardCustomerChartDetailsGrid";
import { DashboardInvoiceChartDetailsGrid } from "./DashboardInvoiceChartDetailsGrid";
import { DashboardPaymentChartDetailsGrid } from "./DashboardPaymentChartDetailsGrid";

interface ChartDetailsProps {
    params: Promise<{ locale: string }>;
}

/** MTD collected detail: invoice payments only (never promise-to-pay rows). */
function isCollectedMtdDetailRow(row: {
    type?: string;
    status?: string;
    invoiceCurrentStatus?: string;
}): boolean {
    if (row.type === "promise" || row.status === "promise") {
        return false;
    }
    const label = String(
        row.invoiceCurrentStatus ?? row.status ?? ""
    ).toLowerCase();
    return !label.includes("promise to pay");
}

function filterCollectedMtdDetailRows<
    T extends {
        type?: string;
        status?: string;
        invoiceCurrentStatus?: string;
        amount?: number;
        paymentAmount?: number;
    }
>(
    chartType: string | null | undefined,
    rows: T[]
): T[] {
    if (!isCollectedMtdChartType(chartType)) {
        return rows;
    }
    return rows.filter(isCollectedMtdDetailRow);
}

function summarizeCollectedMtdRows(
    rows: Array<{ amount?: number; paymentAmount?: number }>
) {
    const totalAmount = rows.reduce(
        (sum, row) =>
            sum + Number(row.paymentAmount ?? row.amount ?? 0),
        0
    );
    return {
        totalRecords: rows.length,
        totalCollectedRecords: rows.length,
        totalAmount,
    };
}

const ChartDetailsPage: React.FC<ChartDetailsProps> = ({ params }) => {
    const resolveDisplayCurrency = (rowCurrency?: string, baseCurrency?: string) =>
        resolveCustomerFirstCurrency({
            customerCurrencyPrimary: rowCurrency,
            fallbackCurrency: baseCurrency,
        });

    const resolvedParams = React.use(params);
    const { t, i18n } = useTranslation(["dashboard", "common"], {
        lng: resolvedParams.locale,
    });
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const { data: session } = useSession();
    const theme = useTheme();
    const windowWidth = useWindowWidth();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const chartType = searchParams?.get("type");
    const period = searchParams?.get("period");

    useEffect(() => {
        if (chartType !== COLLECTED_MTD_CHART_TYPE_LEGACY || !period) {
            return;
        }
        const sp = new URLSearchParams(searchParams?.toString() ?? "");
        sp.set("type", COLLECTED_MTD_CHART_TYPE);
        router.replace(`${pathname}?${sp.toString()}`);
    }, [chartType, period, pathname, router, searchParams]);
    const daysRange = searchParams?.get("daysRange");
    const viewMode = searchParams?.get("viewMode") || "child";
    const businessUnitId = parseDashboardBusinessUnitIdFromUrl(
        searchParams?.get("businessUnitId")
    );

    const useInvoiceReportList = shouldUseDashboardInvoiceReportList({
        type: chartType || "",
        daysRange,
        viewMode,
    });
    const useCustomerReportList = shouldUseDashboardCustomerReportList({
        type: chartType || "",
        period,
        viewMode,
    });
    const usePaymentReportList = shouldUseDashboardPaymentReportList({
        type: chartType || "",
        period,
    });
    const useReportList =
        useInvoiceReportList || useCustomerReportList || usePaymentReportList;

    const [searchValue, setSearchValue] = useState("");
    const [debouncedSearch] = useDebounce(searchValue, 500);
    const [sortModel, setSortModel] = useState<GridSortModel>([]);

    // Get user locale and timezone for date formatting
    const userLocale = getUserDateLocale(session);
    const userTimezone = getUserTimezone(session);

    const handleExport = async (
        _selectedColumns: string[],
        _fileName: string,
        _format: ExportFormat
    ) => {
        const searchParams = appendDashboardBusinessUnitId(
            new URLSearchParams({
                type: chartType!,
                period: period!,
                viewMode: viewMode,
            }),
            businessUnitId
        );

        if (daysRange) {
            searchParams.append("daysRange", daysRange);
        }

        const url = `/api/system/dashboard/chart-details?${searchParams.toString()}`;

        const response = await apiFetch(url, { cache: "no-store" });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error("business_unit_access_denied");
            }
            throw new Error(
                `Failed to fetch chart details: ${response.statusText}`
            );
        }

        const data = await response.json();
        const rawData = filterCollectedMtdDetailRows(chartType, data.data || []);

        // Transform the data to ensure all columns have proper values for export
        const transformedData = rawData.map((row: any, index: number) => {
            const currency = resolveDisplayCurrency(
                row.customerCurrency,
                data.currency
            );

            // Create currency-formatted amounts for splitting with NaN protection and detailed logging
            const amount =
                safeAmount(row.amount, "amount") ||
                safeAmount(row.outstandingAmount, "outstandingAmount") ||
                safeAmount(row.invoiceAmount, "invoiceAmount") ||
                0;
            const outstandingAmount = safeAmount(
                row.outstandingAmount,
                "outstandingAmount"
            );
            const invoiceAmount = safeAmount(
                row.invoiceAmount,
                "invoiceAmount"
            );
            const overdueInvoiceAmount =
                safeAmount(row.overdueInvoiceAmount, "overdueInvoiceAmount") ||
                safeAmount(row.outstandingAmount, "outstandingAmount") ||
                0;
            const originalAmount = safeAmount(
                row.originalAmount,
                "originalAmount"
            );
            const promiseToPayAmount = safeAmount(
                row.promiseToPayAmount,
                "promiseToPayAmount"
            );
            const paymentAmount = safeAmount(
                row.paymentAmount,
                "paymentAmount"
            );
            const paymentAmountInCustomerCurrency = safeAmount(
                row.paymentAmountInCustomerCurrency,
                "paymentAmountInCustomerCurrency"
            );

            const transformedRow = {
                id: index,
                accountId: row.accountId || "",
                customerName: row.customerName || "",
                // Format amounts with currency CODE (not symbol) for splitting - English format
                amount: formatCurrencyWithCode(amount, currency),
                status: row.status || "",
                type: row.type || "",
                phase: row.phase || "",
                collectionPhase: row.collectionPhase || "",
                date: row.date
                    ? formatDateForDisplay(
                        row.date,
                        "date",
                        userLocale,
                        userTimezone
                    )
                    : "",
                overdueStatusChange:
                    row.overdueStatusChange || row.status || row.type || "",
                outstandingAmount: formatCurrencyWithCode(
                    outstandingAmount,
                    currency
                ),
                daysOverdue: row.daysOverdue || 0,
                lastActivity: row.lastActivity || "",
                assignedAgent: row.assignedAgent || "",
                invoiceCount: row.invoiceCount || 0,
                invoiceNumber: row.invoiceNumber || "",
                invoiceAmount: formatCurrencyWithCode(invoiceAmount, currency),
                overdueInvoiceAmount: formatCurrencyWithCode(
                    overdueInvoiceAmount,
                    currency
                ),
                originalAmount: formatCurrencyWithCode(
                    originalAmount,
                    currency
                ),
                daysToPayment: row.daysToPayment || 0,
                newestInvoiceDate: row.newestInvoiceDate
                    ? formatDateForDisplay(
                        row.newestInvoiceDate,
                        "date",
                        userLocale,
                        userTimezone
                    )
                    : "",
                lastActivityDate: row.lastActivityDate
                    ? formatDateForDisplay(
                        row.lastActivityDate,
                        "date",
                        userLocale,
                        userTimezone
                    )
                    : "",
                promiseToPayAmount: formatCurrencyWithCode(
                    promiseToPayAmount,
                    currency
                ),
                promiseToPayDate: row.promiseToPayDate
                    ? formatDateForDisplay(
                        row.promiseToPayDate,
                        "date",
                        userLocale,
                        userTimezone
                    )
                    : "",
                daysSinceLastActivity: row.daysSinceLastActivity || 0,
                paymentDate: row.paymentDate
                    ? formatDateForDisplay(
                        row.paymentDate,
                        "date",
                        userLocale,
                        userTimezone
                    )
                    : "",
                paymentAmount: formatCurrencyWithCode(paymentAmount, currency),
                paymentAmountInCustomerCurrency: formatCurrencyWithCode(
                    paymentAmountInCustomerCurrency,
                    currency
                ),
                invoiceCurrentStatus: row.invoiceCurrentStatus || "",
                customerCurrency: currency,
                raw: row,
            };

            return transformedRow;
        });

        return transformedData;
    };

    // Use regular useQuery hook with search functionality
    const {
        data: chartDetails,
        isLoading,
        error,
    } = useQuery({
        queryKey: [
            "chartDetails",
            useReportList ? "summary-only" : "collected-payments-only",
            chartType,
            period,
            daysRange,
            viewMode,
            businessUnitId,
            useReportList ? "" : debouncedSearch,
            useReportList ? [] : sortModel,
        ],
        queryFn: async () => {
            if (!chartType || !period) {
                return {
                    data: [],
                    summary: { totalRecords: 0, totalAmount: 0 },
                    currency: resolveCustomerFirstCurrency({}),
                };
            }

            const searchParams = appendDashboardBusinessUnitId(
                new URLSearchParams({
                    type: chartType,
                    period: period,
                    viewMode: viewMode,
                }),
                businessUnitId
            );

            if (daysRange) {
                searchParams.append("daysRange", daysRange);
            }

            if (useReportList) {
                searchParams.append("summaryOnly", "true");
            } else {
                if (debouncedSearch) {
                    searchParams.append("search", debouncedSearch);
                }

                // Add sorting parameters
                if (sortModel && sortModel.length > 0) {
                    const sort = sortModel[0];
                    if (sort.field && sort.sort) {
                        searchParams.append("sortBy", sort.field);
                        searchParams.append("sortOrder", sort.sort);
                    }
                }
            }

            const url = `/api/system/dashboard/chart-details?${searchParams.toString()}`;
            const response = await apiFetch(url, { cache: "no-store" });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error("business_unit_access_denied");
                }
                throw new Error(
                    `Failed to fetch chart details: ${response.statusText}`
                );
            }

            const data = await response.json();
            if (useReportList) {
                return {
                    data: [],
                    summary: data.summary || {
                        totalRecords: 0,
                        totalAmount: 0,
                    },
                    currency: resolveCustomerFirstCurrency({
                        fallbackCurrency: data.currency,
                    }),
                };
            }

            const rows = filterCollectedMtdDetailRows(
                chartType,
                data.data || []
            );
            const summary = isCollectedMtdChartType(chartType)
                    ? summarizeCollectedMtdRows(rows)
                    : data.summary || {
                          totalRecords: 0,
                          totalAmount: 0,
                      };

            return {
                data: rows,
                summary,
                currency: resolveCustomerFirstCurrency({
                    fallbackCurrency: data.currency,
                }),
            };
        },
        enabled: !!chartType && !!period,
        staleTime: 0,
    });

    const getChartTitle = (type: string) => {
        if (isCollectedMtdChartType(type)) {
            return t("fields.stats_total_collected_m_t_d", { ns: "dashboard" });
        }

        const titles = {
            "active-customers": t(
                "fields.charts_active_customers_title",
                "Overdue Accounts Dynamics",
                { ns: "dashboard" }
            ),
            "aging-portfolio": t(
                "fields.stats_aging_overdue_portfolio",
                "Aging Overdue Portfolio",
                { ns: "dashboard" }
            ),
            "overdue-amount": t(
                "fields.stats_overdue_amount",
                "Overdue Amount",
                { ns: "dashboard" }
            ),
            "overdue-invoices": t(
                "fields.stats_overdue_invoices",
                "Overdue Invoices",
                { ns: "dashboard" }
            ),
            "overdue-customers": t(
                "fields.stats_overdue_customers",
                "Overdue Customers",
                { ns: "dashboard" }
            ),
            "collection-efforts": t(
                "fields.charts_collection_efforts_phase_title",
                "Collection Efforts Phase",
                { ns: "dashboard" }
            ),
            "automated-phase-split": t(
                "fields.charts_automated_phase_split_title",
                "Automated Phase Split",
                { ns: "dashboard" }
            ),
            "total-due": t("fields.stats_total_due", "Total Due", {
                ns: "dashboard",
            }),
            "due-today": t("fields.stats_due_today", "Due Today", {
                ns: "dashboard",
            }),
            "due-this-week": t("fields.stats_due_this_week", "Due This Week", {
                ns: "dashboard",
            }),
            "due-this-month": t(
                "fields.stats_due_this_month",
                "Due This Month",
                { ns: "dashboard" }
            ),
            "due-next-month": t(
                "fields.stats_due_next_month",
                "Due Next Month",
                { ns: "dashboard" }
            ),
        };

        let title =
            titles[type as keyof typeof titles] ||
            t("fields.chart_details_default_title", "Chart Details", {
                ns: "dashboard",
            });

        // Add period to specific chart types
        if (type === "active-customers" && period) {
            const date = new Date(`${period}-01`); // Add day to make it a valid date
            // Use the page locale instead of session locale for consistent display
            const pageLocale = resolvedParams.locale;
            const monthName = date.toLocaleDateString(pageLocale, {
                month: "short",
            });
            title = `${title} – ${monthName}`;
        }

        // Add days range to aging-portfolio charts
        if (type === "aging-portfolio" && daysRange) {
            const rangeLabels: { [key: string]: string } = {
                "0_7": "0-7 days",
                "8_30": "8-30 days",
                "31_60": "31-60 days",
                "61_90": "61-90 days",
                "91_180": "91-180 days",
                "181_365": "181-365 days",
                "365_2000": "365+ days",
            };
            const rangeLabel = rangeLabels[daysRange] || daysRange;
            title = `${title} – ${rangeLabel}`;
        }

        return title;
    };

    const getChartDescription = (type: string | null | undefined) => {
        if (isCollectedMtdChartType(type)) {
            return t("fields.stats_total_collected_m_t_d_page_description", {
                ns: "dashboard",
            });
        }

        const descriptions: Record<string, string> = {
            "active-customers": t(
                "fields.charts_active_customers_description",
                { ns: "dashboard" }
            ),
            "aging-portfolio": t(
                "fields.charts_aging_overdue_portfolio_description",
                { ns: "dashboard" }
            ),
            "overdue-amount": t(
                "fields.charts_aging_overdue_portfolio_description",
                { ns: "dashboard" }
            ),
            "overdue-invoices": t(
                "fields.charts_aging_overdue_portfolio_description",
                { ns: "dashboard" }
            ),
            "overdue-customers": t(
                "fields.charts_active_customers_description",
                { ns: "dashboard" }
            ),
            "collection-efforts": t(
                "fields.charts_collection_efforts_phase_description",
                { ns: "dashboard" }
            ),
            "automated-phase-split": t(
                "fields.charts_automated_phase_split_description",
                { ns: "dashboard" }
            ),
            "total-due": t(
                "fields.stats_maturity_schedule_description",
                { ns: "dashboard" }
            ),
            "due-today": t(
                "fields.stats_maturity_schedule_description",
                { ns: "dashboard" }
            ),
            "due-this-week": t(
                "fields.stats_maturity_schedule_description",
                { ns: "dashboard" }
            ),
            "due-this-month": t(
                "fields.stats_maturity_schedule_description",
                { ns: "dashboard" }
            ),
            "due-next-month": t(
                "fields.stats_maturity_schedule_description",
                { ns: "dashboard" }
            ),
        };
        return (
            (type ? descriptions[type] : undefined) ||
            t("fields.chart_details_default_title", { ns: "dashboard" })
        );
    };

    const getTotalRecordsLabel = (type: string) => {
        if (isCollectedMtdChartType(type)) {
            return t("fields.charts_collection_stats_total_collected_m_t_d", {
                ns: "dashboard",
            });
        }

        const labels = {
            "active-customers": t(
                "actions.charts_common_added",
                "Entered Overdue",
                { ns: "dashboard" }
            ),
            "aging-portfolio": t(
                "fields.charts_collection_stats_invoices",
                "Invoices",
                { ns: "dashboard" }
            ),
            "overdue-amount": t(
                "fields.stats_overdue_amount",
                "Overdue Amount",
                { ns: "dashboard" }
            ),
            "overdue-invoices": t(
                "fields.stats_overdue_invoices",
                "Overdue Invoices",
                { ns: "dashboard" }
            ),
            "overdue-customers": t(
                "fields.stats_overdue_customers",
                "Overdue Customers",
                { ns: "dashboard" }
            ),
            "collection-efforts": t(
                "fields.charts_collection_efforts_phase_title",
                "Collection Efforts Category",
                { ns: "dashboard" }
            ),
            "automated-phase-split": t(
                "fields.charts_automated_phase_split_title",
                "Automated Phase Split",
                { ns: "dashboard" }
            ),
            "total-due": t("fields.stats_total_due", "Total Due", {
                ns: "dashboard",
            }),
            "due-today": t("fields.stats_due_today", "Due Today", {
                ns: "dashboard",
            }),
            "due-this-week": t("fields.stats_due_this_week", "Due This Week", {
                ns: "dashboard",
            }),
            "due-this-month": t(
                "fields.stats_due_this_month",
                "Due This Month",
                { ns: "dashboard" }
            ),
            "due-next-month": t(
                "fields.stats_due_next_month",
                "Due Next Month",
                { ns: "dashboard" }
            ),
        };
        return (
            labels[type as keyof typeof labels] ||
            t("fields.total_records", { ns: "common" })
        );
    };

    const getSecondCardLabel = (type: string) => {
        if (isCollectedMtdChartType(type)) {
            return t("fields.charts_collection_stats_invoices", {
                ns: "dashboard",
            });
        }

        const labels = {
            "active-customers": t(
                "actions.charts_common_removed",
                "Exited Overdue",
                { ns: "dashboard" }
            ),
            "aging-portfolio": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
            "overdue-amount": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
            "overdue-invoices": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
            "overdue-customers": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
            "collection-efforts": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
            "automated-phase-split": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
            "total-due": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
            "due-today": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
            "due-this-week": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
            "due-this-month": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
            "due-next-month": t(
                "fields.chart_details_total_amount",
                "Total Amount",
                { ns: "dashboard" }
            ),
        };
        return (
            labels[type as keyof typeof labels] ||
            t("fields.chart_details_total_amount", "Total Amount", {
                ns: "dashboard",
            })
        );
    };

    const getSecondCardValue = (type: string) => {
        if (isCollectedMtdChartType(type)) {
            const collectedCount =
                chartDetails?.summary?.totalCollectedRecords ??
                chartDetails?.data?.filter(
                    (row: { type?: string }) => row.type === "collected"
                ).length ??
                0;
            return collectedCount.toLocaleString(userLocale);
        }
        if (type === "active-customers") {
            // Count users who exited overdue status from the actual data
            const exitedCount =
                chartDetails?.data?.filter((row: any) => {
                    const status = (
                        row.overdueStatusChange ||
                        row.status ||
                        row.type ||
                        ""
                    ).toLowerCase();
                    return (
                        status.includes("exited") || status.includes("removed")
                    );
                }).length || 0;
            return exitedCount.toLocaleString(userLocale);
        }
        // For all other types including Due tab types, show total amount
        return formatCurrency(
            chartDetails?.summary?.totalAmount || 0,
            resolveCustomerFirstCurrency({
                fallbackCurrency: chartDetails?.currency,
            })
        );
    };

    const getFirstCardIcon = (type: string) => {
        if (type === "active-customers") {
            return <PersonAddIcon />;
        }
        if (type === "overdue-customers") {
            return <GroupIcon />;
        }
        if (type === "aging-portfolio") {
            return <ReceiptIcon />;
        }
        return <TrendingUpIcon />;
    };

    const getFirstCardIconAccent = (type: string): MetricStatCardIconAccent => {
        if (
            type === "overdue-amount" ||
            type === "overdue-invoices" ||
            type === "overdue-customers" ||
            type === "aging-portfolio"
        ) {
            return "overdue";
        }
        if (type === "active-customers") {
            return "reporting";
        }
        if (isCollectedMtdChartType(type)) {
            return "compliant";
        }
        return "receivables";
    };

    const getSecondCardIconAccent = (type: string): MetricStatCardIconAccent => {
        if (type === "active-customers") {
            return "compliant";
        }
        return "receivables";
    };

    const getFirstCardValue = () => {
        if (isCollectedMtdChartType(chartType)) {
            return formatCurrency(
                chartDetails?.summary?.totalAmount || 0,
                resolveCustomerFirstCurrency({
                    fallbackCurrency: chartDetails?.currency,
                })
            );
        }
        if (chartType === "active-customers") {
            const enteredCount =
                chartDetails?.data?.filter((row: { overdueStatusChange?: string; status?: string; type?: string }) => {
                    const status = (
                        row.overdueStatusChange ||
                        row.status ||
                        row.type ||
                        ""
                    ).toLowerCase();
                    return (
                        status.includes("entered") || status.includes("added")
                    );
                }).length || 0;
            return enteredCount.toLocaleString(userLocale);
        }
        return (
            chartDetails?.summary?.totalRecords?.toLocaleString(userLocale) ||
            "0"
        );
    };

    const getStatusColor = (
        status: string
    ):
        | "primary"
        | "secondary"
        | "success"
        | "error"
        | "warning"
        | "info"
        | "default" => {
        // Enhanced color scheme for collection efforts phase
        const collectionEffortsColors: Record<
            string,
            | "primary"
            | "secondary"
            | "success"
            | "error"
            | "warning"
            | "info"
            | "default"
        > = {
            automated: "secondary", // Secondary - Most automated
            agent: "secondary", // Secondary - Human intervention
            promise: "success", // Success Green (#10B981) - Positive outcome
            dispute: "error", // Error Red (#E53E3E) - Needs attention
            legal: "warning", // Warning Orange (#F59E0B) - Legal intervention
            "automated phase": "secondary",
            "agent phase": "secondary",
            "promise to pay": "success",
            "dispute phase": "error",
            "legal phase": "warning",
        };

        // Legacy colors for other chart types
        const legacyColors: Record<
            string,
            | "primary"
            | "secondary"
            | "success"
            | "error"
            | "warning"
            | "info"
            | "default"
        > = {
            collected: "success",
            active: "success",
            inactive: "default",
            overdue: "error",
            current: "info",
            new: "secondary",
            "0_7": "success",
            "8_30": "warning",
            "31_60": "error",
            "61_90": "error",
            "91_180": "error",
            "181_365": "error",
            "365_plus": "error",
        };

        // Check collection efforts first, then fall back to legacy
        return (
            collectionEffortsColors[status] || legacyColors[status] || "default"
        );
    };

    const formatCurrency = (amount: number, currency: string) => {
        return formatCurrencyWithRTLSupport(
            amount,
            currency,
            userLocale, // Use user locale for number formatting
            i18n.language // Use i18n language for RTL/LTR placement
        );
    };

    // Create a wrapper function that binds locale and timezone for column definitions
    const formatDateForColumn = (date: string | Date): string => {
        return formatDateForDisplay(date, "date", userLocale, userTimezone);
    };

    // Create column definitions
    const columnDefs = createColumnDefinitions({
        t,
        chartDetails,
        formatDateForDisplay: formatDateForColumn,
        getStatusColor,
        theme,
        i18nLanguage: i18n.language,
    });

    // Get columns for current chart type
    const columns = getChartColumns(chartType!, columnDefs, isMobile);

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "50vh",
                }}
            >
                <CircularProgress color="primary" />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">
                    {t(
                        error.message === "business_unit_access_denied"
                            ? "messages.business_unit_access_denied"
                            : "messages.error_loading_dashboard",
                        "Error loading chart details",
                        { ns: "dashboard" }
                    )}
                </Alert>
            </Box>
        );
    }

    if (!chartType || !period) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning">
                    {t("messages.chart_details_missing_parameters", {
                        ns: "dashboard",
                    })}
                </Alert>
            </Box>
        );
    }

    const summaryCardWrapSx = {
        flex: { xs: "1 1 auto", sm: "1 1 300px" },
        minWidth: 0,
        width: { xs: "100%", sm: "auto" },
    } as const;

    return (
        <InternalPageWrapper>
            <Box
                sx={{
                    bgcolor: "background.default",
                    borderRadius: theme.shape.borderRadius,
                }}
            >
                <PageHeader
                    title={getChartTitle(chartType ?? "")}
                    description={getChartDescription(chartType)}
                />

                <Box
                    sx={{
                        display: "flex",
                        gap: { xs: 2, sm: 3 },
                        mb: { xs: 3, sm: 4 },
                        flexWrap: "wrap",
                        flexDirection: { xs: "column", sm: "row" },
                    }}
                >
                    <Box sx={summaryCardWrapSx}>
                        <CreditMetricCard
                            icon={getFirstCardIcon(chartType)}
                            iconAccent={getFirstCardIconAccent(chartType)}
                            label={getTotalRecordsLabel(chartType)}
                            value={getFirstCardValue()}
                        />
                    </Box>

                    <Box sx={summaryCardWrapSx}>
                        <CreditMetricCard
                            icon={
                                chartType === "active-customers" ? (
                                    <PersonRemoveIcon />
                                ) : (
                                    <AccountBalanceIcon />
                                )
                            }
                            iconAccent={getSecondCardIconAccent(chartType)}
                            label={getSecondCardLabel(chartType)}
                            value={getSecondCardValue(chartType)}
                        />
                    </Box>

                    {chartType === "automated-phase-split" && (
                        <Box sx={summaryCardWrapSx}>
                            <CreditMetricCard
                                icon={<ReceiptIcon />}
                                iconAccent="terms"
                                label={t(
                                    "fields.charts_collection_stats_invoices",
                                    "Total Invoices",
                                    { ns: "dashboard" }
                                )}
                                value={
                                    chartDetails?.summary?.totalInvoiceCount?.toLocaleString(
                                        userLocale
                                    ) || "0"
                                }
                            />
                        </Box>
                    )}
                </Box>

                {useInvoiceReportList ? (
                    <DashboardInvoiceChartDetailsGrid
                        chartType={chartType}
                        daysRange={daysRange}
                        viewMode={viewMode}
                        businessUnitId={businessUnitId}
                        searchValue={searchValue}
                        onSearchChange={setSearchValue}
                    />
                ) : useCustomerReportList ? (
                    <DashboardCustomerChartDetailsGrid
                        chartType={chartType}
                        period={period}
                        viewMode={viewMode}
                        businessUnitId={businessUnitId}
                        searchValue={searchValue}
                        onSearchChange={setSearchValue}
                    />
                ) : usePaymentReportList ? (
                    <DashboardPaymentChartDetailsGrid
                        chartType={chartType}
                        period={period}
                        searchValue={searchValue}
                        onSearchChange={setSearchValue}
                    />
                ) : (
                <EndlessScrollDataGrid
                    rows={(Array.isArray(chartDetails?.data)
                        ? chartDetails?.data || []
                        : []
                    ).map((row: any, index: number) => {
                        const currency = resolveDisplayCurrency(
                            row.customerCurrency,
                            chartDetails?.currency
                        );

                        return {
                            id: index,
                            accountId: row.accountId || "",
                            customerName: row.customerName || "",
                            // Pass raw numeric values for display - let column renderers handle formatting
                            amount:
                                safeAmount(row.amount, "amount") ||
                                safeAmount(
                                    row.outstandingAmount,
                                    "outstandingAmount"
                                ) ||
                                safeAmount(row.invoiceAmount, "invoiceAmount") ||
                                0,
                            status: row.status || "",
                            type: row.type || "",
                            phase: row.phase || "",
                            collectionPhase: row.collectionPhase || "",
                            date: row.date
                                ? formatDateForDisplay(
                                    row.date,
                                    "date",
                                    userLocale,
                                    userTimezone
                                )
                                : "",
                            overdueStatusChange:
                                row.overdueStatusChange ||
                                row.status ||
                                row.type ||
                                "",
                            outstandingAmount: safeAmount(
                                row.outstandingAmount,
                                "outstandingAmount"
                            ),
                            daysOverdue: row.daysOverdue || 0,
                            lastActivity: row.lastActivity || "",
                            assignedAgent: row.assignedAgent || "",
                            invoiceCount: row.invoiceCount || 0,
                            invoiceNumber: row.invoiceNumber || "",
                            invoiceAmount: safeAmount(
                                row.invoiceAmount,
                                "invoiceAmount"
                            ),
                            overdueInvoiceAmount:
                                safeAmount(
                                    row.overdueInvoiceAmount,
                                    "overdueInvoiceAmount"
                                ) ||
                                safeAmount(
                                    row.outstandingAmount,
                                    "outstandingAmount"
                                ) ||
                                0,
                            originalAmount: safeAmount(
                                row.originalAmount,
                                "originalAmount"
                            ),
                            daysToPayment: row.daysToPayment || 0,
                            newestInvoiceDate: row.newestInvoiceDate
                                ? formatDateForDisplay(
                                    row.newestInvoiceDate,
                                    "date",
                                    userLocale,
                                    userTimezone
                                )
                                : "",
                            lastActivityDate: row.lastActivityDate
                                ? formatDateForDisplay(
                                    row.lastActivityDate,
                                    "date",
                                    userLocale,
                                    userTimezone
                                )
                                : "",
                            promiseToPayAmount: safeAmount(
                                row.promiseToPayAmount,
                                "promiseToPayAmount"
                            ),
                            promiseToPayDate: row.promiseToPayDate
                                ? formatDateForDisplay(
                                    row.promiseToPayDate,
                                    "date",
                                    userLocale,
                                    userTimezone
                                )
                                : "",
                            daysSinceLastActivity: row.daysSinceLastActivity || 0,
                            paymentDate: row.paymentDate
                                ? formatDateForDisplay(
                                    row.paymentDate,
                                    "date",
                                    userLocale,
                                    userTimezone
                                )
                                : "",
                            paymentAmount: safeAmount(
                                row.paymentAmount,
                                "paymentAmount"
                            ),
                            paymentAmountInCustomerCurrency: safeAmount(
                                row.paymentAmountInCustomerCurrency,
                                "paymentAmountInCustomerCurrency"
                            ),
                            invoiceCurrentStatus: row.invoiceCurrentStatus || "",
                            customerCurrency: currency,
                            raw: row,
                        };
                    })}
                    columns={columns}
                    totalRecords={chartDetails?.summary?.totalRecords || 0}
                    isLoading={isLoading}
                    onLoadMore={() => { }} // No pagination needed for chart details
                    hasMore={false} // No pagination needed for chart details
                    sortModel={
                        sortModel.length > 0
                            ? sortModel
                            : chartType === "overdue-invoices"
                                ? [{ field: "invoiceNumber", sort: "asc" }]
                                : chartType === "aging-portfolio"
                                    ? [{ field: "daysOverdue", sort: "desc" }]
                                    : chartType === "active-customers"
                                        ? [{ field: "date", sort: "desc" }]
                                        : chartType === "total-due" ||
                                            chartType === "due-today" ||
                                            chartType === "due-this-week" ||
                                            chartType === "due-this-month" ||
                                            chartType === "due-next-month"
                                            ? [{ field: "daysToPayment", sort: "asc" }]
                                            : [
                                                {
                                                    field: "outstandingAmount",
                                                    sort: "desc",
                                                },
                                            ]
                    }
                    onSortModelChange={setSortModel}
                    columnVisibilityModel={
                        chartType === "overdue-invoices" ||
                            chartType === "aging-portfolio"
                            ? {}
                            : {
                                // Hide less important columns on mobile for other chart types
                                invoiceNumber: windowWidth >= BREAKPOINTS.MOBILE,
                                originalAmount: windowWidth >= BREAKPOINTS.TABLET,
                                daysToPayment: windowWidth >= BREAKPOINTS.TABLET,
                                assignedAgent: windowWidth >= BREAKPOINTS.DESKTOP,
                                lastActivity: windowWidth >= BREAKPOINTS.TABLET,
                                newestInvoiceDate:
                                    windowWidth >= BREAKPOINTS.DESKTOP,
                                promiseToPayAmount:
                                    windowWidth >= BREAKPOINTS.TABLET,
                                promiseToPayDate:
                                    windowWidth >= BREAKPOINTS.DESKTOP,
                                lastActivityDate:
                                    windowWidth >= BREAKPOINTS.DESKTOP,
                            }
                    }
                    language={i18n.language}
                    fillViewport={true}
                    resizableColumns={true}
                    // Search functionality
                    searchValue={searchValue}
                    onSearchChange={(value) => {
                        setSearchValue(value);
                    }}
                    searchDisabled={false}
                    searchPlaceholder={t("fields.search", "Search...", {
                        ns: "common",
                    })}
                    // Export props
                    onExport={handleExport}
                    exportDisabled={false}
                    exportContextInfo={{
                        pageName: getChartTitle(chartType),
                    }}
                    // Currency columns configuration for export splitting
                    currencyColumns={
                        {
                            amount: {
                                amountField: "amount_value",
                                currencyField: "amount_currency",
                            },
                            outstandingAmount: {
                                amountField: "outstanding_amount_value",
                                currencyField: "outstanding_amount_currency",
                            },
                            invoiceAmount: {
                                amountField: "invoice_amount_value",
                                currencyField: "invoice_amount_currency",
                            },
                            overdueInvoiceAmount: {
                                amountField: "overdue_invoice_amount_value",
                                currencyField: "overdue_invoice_amount_currency",
                            },
                            originalAmount: {
                                amountField: "original_amount_value",
                                currencyField: "original_amount_currency",
                            },
                            promiseToPayAmount: {
                                amountField: "promise_to_pay_amount_value",
                                currencyField: "promise_to_pay_amount_currency",
                            },
                            paymentAmount: {
                                amountField: "payment_amount_value",
                                currencyField: "payment_amount_currency",
                            },
                            paymentAmountInCustomerCurrency: {
                                amountField:
                                    "payment_amount_customer_currency_value",
                                currencyField:
                                    "payment_amount_customer_currency_currency",
                            },
                        } as CurrencyColumnsConfig
                    }
                    noRowsMessage={t("messages.no_results", { ns: "common" })}
                    noRowsDescription={t("messages.no_results_description", {
                        ns: "common",
                    })}
                />
                )}
            </Box>
        </InternalPageWrapper>
    );
};

export default ChartDetailsPage;
