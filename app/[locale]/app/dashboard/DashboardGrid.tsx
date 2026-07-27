"use client";
import { Box, CircularProgress } from "@mui/material";
import React from "react";

import { DashboardResponse } from "@/types/Dashboard";
import { resolveCustomerFirstCurrency } from "@/utils/stringFormatters";

import OverdueCustomersCard from "./(cards)/ActiveAccountsCard";
import ActiveAccountsChart from "./(cards)/ActiveAccountsChart";
import AgingOverduePortfolio from "./(cards)/AgingOverduePortfolio";
import AmountByEntityChart from "./(cards)/AmountByEntityChart";
import AutomatedPhaseSplit from "./(cards)/AutomatedPhaseSplit";
import CollectedVsPromiseChart from "./(cards)/CollectedVsPromiseChart";
import CollectionEffortsPhase from "./(cards)/CollectionEffortsPhase";
import CollectionStats from "./(cards)/CollectionStats";
import DueNextMonthCard from "./(cards)/DueNextMonthCard";
import DueThisMonthCard from "./(cards)/DueThisMonthCard";
import DueThisWeekCard from "./(cards)/DueThisWeekCard";
import DueTodayCard from "./(cards)/DueTodayCard";
import OverdueAmountCard from "./(cards)/OverdueAmountCard";
import OverdueInvoicesCard from "./(cards)/OverdueInvoicesCard";
import ReceivablesMaturitySchedule from "./(cards)/ReceivablesMaturitySchedule";
import TotalCollectedCard from "./(cards)/TotalCollectedCard";
import TotalDueCard from "./(cards)/TotalDueCard";

interface DashboardGridProps {
    data?: DashboardResponse;
    activeTab?: number;
    viewMode?: "child" | "parent";
    pageLoaded?: boolean;
}

const DashboardGrid = ({
    data,
    activeTab = 0,
    viewMode = "child",
    pageLoaded = false,
}: DashboardGridProps) => {
    // Get total collected amount directly from the API response
    const totalCollectedAmount = String(data?.totalCollected || "0");
    const currency = resolveCustomerFirstCurrency({
        fallbackCurrency: data?.currency,
    });
    const isOverdueTab = activeTab === 0;
    const isDueTab = activeTab === 1;

    // If data is not available yet, show loading state
    if (!data) {
        return (
            <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                minHeight="400px"
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        lg: isOverdueTab ? "13fr 7fr" : "1fr",
                    },
                    gap: 2,
                    width: "100%",
                }}
            >
                {/* Left Column - Main Content */}
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, minmax(0, 1fr))",
                            md: isOverdueTab
                                ? "repeat(4, minmax(0, 1fr))"
                                : "repeat(5, minmax(0, 1fr))",
                            lg: isOverdueTab
                                ? "repeat(4, minmax(0, 1fr))"
                                : "repeat(5, minmax(0, 1fr))",
                        },
                        gap: 2,
                        alignItems: "stretch",
                        "& .MuiCardContent-root": {
                            minHeight: 120,
                        },
                    }}
                >
                    {/* Top Row Cards */}
                    {isOverdueTab ? (
                        // Overdue Tab
                        <>
                            <Box
                                className="dashboard-metric-card-slot"
                                sx={{ height: "100%", minHeight: 120, minWidth: 0 }}
                            >
                                <OverdueCustomersCard
                                    count={data.activeCustomers || 0}
                                    viewMode={viewMode}
                                />
                            </Box>
                            <Box
                                className="dashboard-metric-card-slot"
                                sx={{ height: "100%", minHeight: 120, minWidth: 0 }}
                            >
                                <OverdueAmountCard
                                    count={data.overdueAmount || 0}
                                    currency={currency}
                                    viewMode={viewMode}
                                />
                            </Box>
                            <Box
                                className="dashboard-metric-card-slot"
                                sx={{ height: "100%", minHeight: 120, minWidth: 0 }}
                            >
                                <OverdueInvoicesCard
                                    count={data.overdueInvoices || 0}
                                />
                            </Box>
                            <Box
                                className="dashboard-metric-card-slot"
                                sx={{ height: "100%", minHeight: 120, minWidth: 0 }}
                            >
                                <TotalCollectedCard
                                    amount={totalCollectedAmount}
                                    currency={currency}
                                />
                            </Box>
                        </>
                    ) : (
                        // Due Tab
                        <>
                            <Box
                                className="dashboard-metric-card-slot"
                                sx={{ height: "100%", minHeight: 120, minWidth: 0 }}
                            >
                                <TotalDueCard
                                    count={data.totalDue || 0}
                                    currency={currency}
                                />
                            </Box>
                            <Box
                                className="dashboard-metric-card-slot"
                                sx={{ height: "100%", minHeight: 120, minWidth: 0 }}
                            >
                                <DueTodayCard
                                    count={data.dueToday || 0}
                                    currency={currency}
                                />
                            </Box>
                            <Box
                                className="dashboard-metric-card-slot"
                                sx={{ height: "100%", minHeight: 120, minWidth: 0 }}
                            >
                                <DueThisWeekCard
                                    count={data.dueThisWeek || 0}
                                    currency={currency}
                                />
                            </Box>
                            <Box
                                className="dashboard-metric-card-slot"
                                sx={{ height: "100%", minHeight: 120, minWidth: 0 }}
                            >
                                <DueThisMonthCard
                                    count={data.dueThisMonth || 0}
                                    currency={currency}
                                />
                            </Box>
                            <Box
                                className="dashboard-metric-card-slot"
                                sx={{ height: "100%", minHeight: 120, minWidth: 0 }}
                            >
                                <DueNextMonthCard
                                    count={data.dueNextMonth || 0}
                                    currency={currency}
                                />
                            </Box>
                        </>
                    )}

                    {/* Receivables Maturity Schedule - Only show on Due tab after page is loaded */}
                    {isDueTab && pageLoaded && (
                        <Box
                            sx={{
                                gridColumn: { xs: "1 / -1", md: "1 / -1" },
                                height: "100%",
                                minHeight: "500px",
                            }}
                        >
                            <ReceivablesMaturitySchedule
                                data={data.receivablesMaturitySchedule || []}
                                currency={currency}
                            />
                        </Box>
                    )}

                    {/* Invoices by Customer Chart - Only show on Due tab after page is loaded */}
                    {isDueTab && pageLoaded && (
                        <Box
                            sx={{
                                gridColumn: { xs: "1 / -1", md: "1 / -1" },
                                height: "100%",
                                minHeight: "400px",
                            }}
                        >
                            <AmountByEntityChart
                                data={data.invoicesByCustomer || []}
                                currency={currency}
                            />
                        </Box>
                    )}

                    {/* Invoices by Business Unit Chart - Only show on Due tab, below Invoices by Customer, if user's BU has children, after page is loaded */}
                    {isDueTab && pageLoaded && data?.hasChildBusinessUnits && (
                        <Box
                            sx={{
                                gridColumn: { xs: "1 / -1", md: "1 / -1" },
                                height: "100%",
                                minHeight: "400px",
                                mt: 2,
                            }}
                        >
                            <AmountByEntityChart
                                data={data.invoicesByBusinessUnit || []}
                                currency={currency}
                                titleKey="fields.stats_invoices_by_business_unit"
                                barLabelKey="fields.stats_invoices_by_business_unit_bar"
                                donutLabelKey="fields.stats_invoices_by_business_unit_doughnut"
                                horizontal={false}
                                donutFirst={true}
                            />
                        </Box>
                    )}

                    {/* Collected vs Promise Chart - Only show on Overdue tab */}
                    {isOverdueTab && (
                        <Box
                            sx={{
                                gridColumn: { xs: "1 / -1", md: "1 / -1" },
                                height: "100%",
                                minHeight: "500px",
                            }}
                        >
                            <CollectedVsPromiseChart
                                options={data.audienceReport?.options || {}}
                                series={data.audienceReport?.series || []}
                            />
                        </Box>
                    )}

                    {/* Aging Portfolio - Only show on Overdue tab */}
                    {isOverdueTab && (
                        <Box
                            sx={{
                                gridColumn: { xs: "1 / -1", md: "1 / -1" },
                                height: "100%",
                                minHeight: "280px",
                            }}
                        >
                            <AgingOverduePortfolio
                                rows={data.agingPortfolio?.chartData || []}
                                chartData={data.agingPortfolio?.chartData || []}
                                currency={currency}
                            />
                        </Box>
                    )}
                </Box>

                {/* Right Column - Sidebar Content - Only show on Overdue tab */}
                {isOverdueTab && (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                xl: "1fr 2fr",
                            },
                            gap: 1,
                            alignItems: "start",
                        }}
                    >
                        {/* Collection Efforts Phase - Top Right */}
                        <Box
                            sx={{
                                gridColumn: { xs: "1 / -1", xl: "1 / -1" },
                                height: "100%",
                                minHeight: "200px",
                            }}
                        >
                            <CollectionEffortsPhase
                                options={
                                    data.collectionEffortsPhase?.options || {}
                                }
                                series={
                                    data.collectionEffortsPhase?.series || []
                                }
                                phaseStats={
                                    data.collectionEffortsPhase?.stats || []
                                }
                            />
                        </Box>

                        {/* Collection Stats */}
                        <Box
                            sx={{
                                gridColumn: { xs: "1 / -1", xl: "1 / -1" },
                                height: "100%",
                                minHeight: "200px",
                            }}
                        >
                            <CollectionStats
                                stats={data.collectionStats || []}
                            />
                        </Box>

                        {/* Automated Phase Split */}
                        <Box
                            sx={{
                                gridColumn: { xs: "1 / -1", xl: "1 / -1" },
                                height: "400px",
                            }}
                        >
                            <AutomatedPhaseSplit
                                options={
                                    data.automatedPhaseSplit?.options || {}
                                }
                                series={data.automatedPhaseSplit?.series || []}
                            />
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Overdue Invoices by Customer Chart - Only show on Overdue tab, above Overdue Accounts Dynamics */}
            {isOverdueTab && (
                <Box
                    sx={{
                        width: "100%",
                        height: "100%",
                        minHeight: "300px",
                        mt: 2,
                        mb: 2,
                    }}
                >
                    <AmountByEntityChart
                        data={data.overdueInvoicesByCustomer || []}
                        currency={currency}
                        titleKey="fields.stats_overdue_invoices_by_customer"
                    />
                </Box>
            )}

            {/* Overdue Invoices by Business Unit Chart - Only show on Overdue tab, below Overdue Invoices by Customer, if user's BU has children */}
            {isOverdueTab && data?.hasChildBusinessUnits && (
                <Box
                    sx={{
                        width: "100%",
                        height: "100%",
                        minHeight: "300px",
                        mt: 2,
                        mb: 2,
                    }}
                >
                    <AmountByEntityChart
                        data={data.overdueInvoicesByBusinessUnit || []}
                        currency={currency}
                        titleKey="fields.stats_overdue_invoices_by_business_unit"
                        barLabelKey="fields.stats_invoices_by_business_unit_bar"
                        donutLabelKey="fields.stats_invoices_by_business_unit_doughnut"
                        horizontal={false}
                        donutFirst={true}
                    />
                </Box>
            )}

            {/* Bottom Full Width Chart - Only show on Overdue tab */}
            {activeTab === 0 && (
                <Box sx={{ mt: 2, height: "375px" }}>
                    <ActiveAccountsChart
                        options={data.activeCustomersChart?.options || {}}
                        series={data.activeCustomersChart?.series || []}
                    />
                </Box>
            )}
        </>
    );
};

export default DashboardGrid;
