"use client";
import { apiFetch } from "@/utils/apiFetch";

import { useSession } from "next-auth/react";

import {
    People as PeopleIcon,
    Receipt as ReceiptIcon,
    AttachMoney as MoneyIcon,
    Gavel as GavelIcon,
} from "@mui/icons-material";
import { Box, Skeleton } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
    useState,
    useCallback,
    useMemo,
    useRef,
    useEffect,
} from "react";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";

import DisputeAgentChart from "./components/DisputeAgentChart";
import DisputeReasonChart from "./components/DisputeReasonChart";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { fetchDisputeStats } from "@/shared/services/disputeService";
import { clearDisputeNotifications } from "@/shared/services/notificationService";
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
import { useTheme } from "@mui/material/styles";

interface DisputeListProps {
    title?: string;
    description?: string;
}

const DisputeList: React.FC<DisputeListProps> = ({ title, description }) => {
    const { t, i18n } = useTranslation(["disputes", "common", "reports"]);
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const { success, error: showError } = useToast();
    const theme = useTheme();

    // Prefer account currency from stats (works without re-login); session is
    // the long-term source once JWT carries Account.currency again.
    const { data: disputeStatsPayload } = useQuery({
        queryKey: ["disputeStats", {}],
        queryFn: fetchDisputeStats,
        refetchOnWindowFocus: false,
    });
    const accountCurrency =
        disputeStatsPayload?.stats?.currency || session?.user?.currency;

    const [search, setSearch] = useState("");
    const [selectedViewId, setSelectedViewId] = useState<number | null>(null);
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [tableRows, setTableRows] = useState<any[]>([]);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Delete confirmation state
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        viewId: number | null;
        viewName: string | null;
    }>({
        isOpen: false,
        viewId: null,
        viewName: null,
    });

    // Calculate stats from table rows
    const statsData = useMemo(() => {
        if (!tableRows || tableRows.length === 0) {
            return {
                stats: {
                    totalAmount: 0,
                    totalCustomers: 0,
                    openInvoices: 0,
                    disputeAssignFrequencyList: [],
                    pieChartData: { labels: [], series: [] },
                },
            };
        }


        // Calculate total amount (sum of amount_in_dispute from all rows)
        // The report data uses different field naming conventions
        const totalAmount = tableRows.reduce((sum, row) => {
            // Try different possible field names for amount
            let amount =
                row["Dispute.amount_in_dispute"] ||
                row.amount_in_dispute ||
                row.amount ||
                row["amount"] ||
                0;

            // If amount is a string (formatted currency like "USD 15,000"), parse it
            if (typeof amount === "string") {
                // Remove currency symbols, commas, and spaces, keep only numbers and decimal point
                const numericString = amount.replace(/[^0-9.-]/g, "");
                amount = parseFloat(numericString) || 0;
            }

            return sum + (typeof amount === "number" ? amount : 0);
        }, 0);

        // Calculate unique customers
        const uniqueCustomerIds = new Set(
            tableRows.map((row) =>
                row.customer_id ||
                row["Dispute.customer_id"] ||
                row.id
            ).filter(Boolean)
        );
        const totalCustomers = uniqueCustomerIds.size;

        // Calculate total unique invoices across all disputes
        // For report data, we need to count from the table rows directly
        // since DisputeInvoice relation might not be included in the view
        const allInvoiceIds = new Set<number>();
        tableRows.forEach((row) => {
            // Check if DisputeInvoice data is available in raw field
            const rawData = row.raw || row;

            if (rawData.DisputeInvoice && Array.isArray(rawData.DisputeInvoice)) {
                rawData.DisputeInvoice.forEach((di: any) => {
                    if (di.invoice_id) {
                        allInvoiceIds.add(di.invoice_id);
                    }
                });
            }
            // Also check for direct invoice_id field
            if (rawData.invoice_id) {
                allInvoiceIds.add(rawData.invoice_id);
            }
        });

        // If no invoice data found, use the count of disputes as a proxy
        // (each dispute typically has at least one invoice)
        const openInvoices = allInvoiceIds.size > 0 ? allInvoiceIds.size : tableRows.length;


        // Calculate dispute assignment frequency
        const assignmentMap = new Map<string, number>();
        tableRows.forEach((row) => {
            const assignee =
                row["Dispute.assigned_to"] ||
                row.User_CustomerDispute_owner_idToUser?.name ||
                row.User?.name ||
                row.assigned_to ||
                "Unassigned";
            assignmentMap.set(assignee, (assignmentMap.get(assignee) || 0) + 1);
        });

        const disputeAssignFrequencyList = Array.from(
            assignmentMap.entries()
        ).map(([name, count]) => ({
            name,
            dispute_count: count,
            user_image: null,
        }));

        // Calculate dispute reason distribution
        const reasonMap = new Map<string, number>();
        tableRows.forEach((row) => {
            const reason =
                row["Dispute.dispute_reason"] ||
                row.DisputeReason?.name ||
                row.dispute_reason ||
                "Unknown";
            reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
        });

        const pieChartData = {
            labels: Array.from(reasonMap.keys()),
            series: Array.from(reasonMap.values()),
        };

        return {
            stats: {
                totalAmount,
                totalCustomers,
                openInvoices,
                disputeAssignFrequencyList,
                pieChartData,
            },
        };
    }, [tableRows]);

    const statsLoading = false; // Stats are calculated from table data, no loading needed

    // Clear dispute notifications when the component mounts
    useEffect(() => {
        clearDisputeNotifications();
        // Invalidate reports list cache to ensure updated report names and default icons are shown
        // This ensures the is_default field is fresh when the component loads
        queryClient.invalidateQueries({
            queryKey: ["reports-list"],
        });
        queryClient.invalidateQueries({ queryKey: ["view"] });
        // Invalidate user-default-report query to ensure default icon is shown correctly
        queryClient.invalidateQueries({
            queryKey: ["user-default-report"],
        });
    }, [queryClient]);

    // Handle delete view
    const handleDeleteView = useCallback(
        async (viewId: number) => {
            try {
                const response = await apiFetch(`/api/reports/${viewId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.report?.is_system) {
                        showError(
                            t("reports.messages.cannot_delete_system_report", {
                                defaultValue: "System views cannot be deleted",
                            })
                        );
                        return;
                    }
                    const viewName = data.report?.name || "";
                    setDeleteConfirmation({
                        isOpen: true,
                        viewId,
                        viewName,
                    });
                }
            } catch {
                setDeleteConfirmation({
                    isOpen: true,
                    viewId,
                    viewName: "",
                });
            }
        },
        [showError, t]
    );

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteConfirmation.viewId) return;

        try {
            const response = await apiFetch(`/api/reports/${deleteConfirmation.viewId}`,
                {
                    method: "DELETE",
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete view");
            }

            if (selectedViewId === deleteConfirmation.viewId) {
                setSelectedViewId(null);
            }

            await queryClient.invalidateQueries({
                queryKey: ["reports-list"],
            });

            setDeleteConfirmation({
                isOpen: false,
                viewId: null,
                viewName: null,
            });
            success(
                t("reports.messages.delete_report_success", {
                    defaultValue: "View deleted successfully",
                })
            );
        } catch (error) {
            showError(
                error instanceof Error
                    ? error.message
                    : t("reports.messages.delete_report_error", {
                        defaultValue: "Failed to delete view",
                    })
            );
        }
    }, [
        deleteConfirmation,
        selectedViewId,
        queryClient,
        success,
        showError,
        t,
    ]);

    const handleCancelDelete = useCallback(() => {
        setDeleteConfirmation({
            isOpen: false,
            viewId: null,
            viewName: null,
        });
    }, []);

    return (
        <InternalPageWrapper>
            <Box
                sx={{
                    bgcolor: "background.default",
                    borderRadius: theme.shape.borderRadius,
                    position: "relative",
                    isolation: "isolate",
                }}
            >
                <PageHeader
                    title={title || t("sections.title")}
                    description={description || t("sections.description")}
                />

                {/* Charts and Stats Section */}
                <Box sx={{ mb: 3, mt: 3 }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                md: "1fr 1fr",
                                lg: "1fr 1fr 1fr",
                            },
                            gap: { xs: 2, sm: 3 },
                            mb: 3,
                            width: "100%",
                            boxSizing: "border-box",
                            contain: "layout",
                        }}
                    >
                        {/* First chart */}
                        <Box
                            sx={{
                                minHeight: { xs: "250px", sm: "280px" },
                                pt: 1,
                            }}
                        >
                            <DisputeReasonChart
                                pieChartData={statsData?.stats?.pieChartData}
                                isLoading={statsLoading}
                            />
                        </Box>

                        {/* Second chart */}
                        <Box
                            sx={{
                                minHeight: { xs: "250px", sm: "280px" },
                                pt: 1,
                            }}
                        >
                            <DisputeAgentChart
                                disputeAssignFrequencyList={
                                    statsData?.stats?.disputeAssignFrequencyList
                                }
                                isLoading={statsLoading}
                            />
                        </Box>

                        {/* Stats Cards in 2x2 grid */}
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignSelf: "stretch",
                                height: "100%",
                                minHeight: { xs: "250px", sm: "280px" },
                                gap: 1,
                                pt: 1,
                            }}
                        >
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 1.5,
                                    flex: 1,
                                    minHeight: 0,
                                }}
                            >
                                <Box
                                    sx={{
                                        height: "100%",
                                        minHeight: 132,
                                        display: "flex",
                                        "& > .MuiCard-root": {
                                            flex: 1,
                                            width: "100%",
                                        },
                                    }}
                                >
                                    <CreditMetricCard
                                        icon={<GavelIcon />}
                                        iconAccent="atRisk"
                                        label={t("sections.total_disputes")}
                                        value={
                                            statsLoading ? (
                                                <Skeleton
                                                    variant="text"
                                                    width={80}
                                                    height={28}
                                                />
                                            ) : (
                                                (
                                                    statsData?.stats?.disputeAssignFrequencyList?.reduce(
                                                        (sum: number, item: any) =>
                                                            sum + item.dispute_count,
                                                        0
                                                    ) || 0
                                                ).toLocaleString(
                                                    i18n.language === "he"
                                                        ? "he-IL"
                                                        : "en-US"
                                                )
                                            )
                                        }
                                    />
                                </Box>
                                <Box
                                    sx={{
                                        height: "100%",
                                        minHeight: 132,
                                        display: "flex",
                                        "& > .MuiCard-root": {
                                            flex: 1,
                                            width: "100%",
                                        },
                                    }}
                                >
                                    <CreditMetricCard
                                        icon={<PeopleIcon />}
                                        iconAccent="compliant"
                                        label={t("sections.total_customers", {
                                            ns: "common",
                                        })}
                                        value={
                                            statsLoading ? (
                                                <Skeleton
                                                    variant="text"
                                                    width={80}
                                                    height={28}
                                                />
                                            ) : (
                                                (
                                                    statsData?.stats
                                                        ?.totalCustomers || 0
                                                ).toLocaleString(
                                                    i18n.language === "he"
                                                        ? "he-IL"
                                                        : "en-US"
                                                )
                                            )
                                        }
                                    />
                                </Box>
                            </Box>
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 1.5,
                                    flex: 1,
                                    minHeight: 0,
                                }}
                            >
                                <Box
                                    sx={{
                                        height: "100%",
                                        minHeight: 132,
                                        display: "flex",
                                        "& > .MuiCard-root": {
                                            flex: 1,
                                            width: "100%",
                                        },
                                    }}
                                >
                                    <CreditMetricCard
                                        icon={<MoneyIcon />}
                                        iconAccent="receivables"
                                        label={t("sections.total_amount")}
                                        value={
                                            statsLoading ? (
                                                <Skeleton
                                                    variant="text"
                                                    width={80}
                                                    height={28}
                                                />
                                            ) : (
                                                formatCurrencyWithRTLSupport(
                                                    statsData?.stats
                                                        ?.totalAmount || 0,
                                                    resolveCustomerFirstCurrency(
                                                        {
                                                            accountCurrency,
                                                        }
                                                    ),
                                                    getUserDateLocale(session),
                                                    i18n.language
                                                )
                                            )
                                        }
                                    />
                                </Box>
                                <Box
                                    sx={{
                                        height: "100%",
                                        minHeight: 132,
                                        display: "flex",
                                        "& > .MuiCard-root": {
                                            flex: 1,
                                            width: "100%",
                                        },
                                    }}
                                >
                                    <CreditMetricCard
                                        icon={<ReceiptIcon />}
                                        iconAccent="overdue"
                                        label={t("sections.open_invoices")}
                                        value={
                                            statsLoading ? (
                                                <Skeleton
                                                    variant="text"
                                                    width={80}
                                                    height={28}
                                                />
                                            ) : (
                                                (
                                                    statsData?.stats
                                                        ?.openInvoices || 0
                                                ).toLocaleString(
                                                    i18n.language === "he"
                                                        ? "he-IL"
                                                        : "en-US"
                                                )
                                            )
                                        }
                                    />
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {/* Virtual Grid */}
                <Box
                    ref={tableContainerRef}
                    sx={{
                        position: "relative",
                        isolation: "isolate",
                    }}
                >
                    <ViewBasedDataGrid
                        context="disputes"
                        searchValue={search}
                        onRowsChange={setTableRows}
                        onSearchChange={setSearch}
                        defaultViewId={null}
                        onViewChange={setSelectedViewId}
                        exportDisabled={false}
                        onSelectedRowsChange={setSelectedRows}
                        onDeleteView={handleDeleteView}
                        enableMultiSelect={false}
                    />
                </Box>

                {/* Delete View Confirmation Dialog */}
                <DeleteDialog
                    isOpen={deleteConfirmation.isOpen}
                    onClose={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    title={t("reports.actions.delete_report", {
                        defaultValue: "Delete View",
                    })}
                    description={
                        deleteConfirmation.viewName
                            ? `${t(
                                "reports.messages.delete_report_confirmation",
                                {
                                    defaultValue:
                                        "Are you sure you want to delete this view?",
                                }
                            )} "${deleteConfirmation.viewName}"?`
                            : t("reports.messages.delete_report_confirmation", {
                                defaultValue:
                                    "Are you sure you want to delete this view?",
                            })
                    }
                    confirmLabel={t("actions.delete", { ns: "common" })}
                    cancelLabel={t("actions.cancel", { ns: "common" })}
                    type="delete"
                    locale={i18n.language}
                />
            </Box>
        </InternalPageWrapper>
    );
};

export default DisputeList;
