import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";
import { CustomerData, DashboardResponse } from "@/types/Dashboard";
import { linkedInvoicePaymentWhere } from "@/utils/invoicePaymentFilters";

// Type definitions for better type safety
interface OwnerFilter {
    owner_id?: string | null;
    OR?: Array<{ owner_id: string | null }>;
}

interface ActiveCustomersData {
    count: number;
    details: any[]; // Will be properly typed based on Prisma return type
}

interface OverdueAmountData {
    amount: number;
    count: number; // Count of customers with overdue amounts
    details: any[]; // Will be properly typed based on Prisma return type
}

interface OverdueInvoicesData {
    count: number;
    details: any[]; // Will be properly typed based on Prisma return type
}

interface DueAmountData {
    amount: number;
    details: any[]; // Will be properly typed based on Prisma return type
}

interface MaturityRow {
    id: number;
    invoices: number;
    accounts: number;
    amount: number;
    daysRange: string;
    amountPercentage: string;
}

interface CollectedVsPromiseData {
    totalCollected: number;
    chartData: {
        collectedData: number[];
        promiseToPayData: number[];
    };
    details: {
        collectedInvoices: any[];
        promiseToPayRecords: any[];
    };
}

interface AgingPortfolioData {
    chartData: any[];
    details: any[];
}

interface CollectionEffortsPhaseData {
    chartData: {
        series: number[];
        stats: Array<{ label: string; value: string }>;
    };
    details: {
        automatedCount: number;
        agentCount: number;
        promiseToPayCount: number;
        disputeCount: number;
        legalCount: number;
        automatedInvoiceCount: number;
        agentInvoiceCount: number;
        promiseToPayInvoiceCount: number;
        disputeInvoiceCount: number;
        legalInvoiceCount: number;
        automatedCustomers: any[];
        agentCustomers: any[];
        promiseToPayCustomers: any[];
        disputeCustomers: any[];
        legalCustomers: any[];
    };
}

interface AutomatedPhaseSplitData {
    chartData: {
        series: Array<{
            name: string;
            type: string;
            data: number[];
        }>;
        categories: string[];
    };
    details: {
        automatedInvoiceCount: number;
        agentInvoiceCount: number;
        promiseToPayInvoiceCount: number;
        disputePhaseInvoiceCount: number;
        automatedCount: number;
        agentCount: number;
        promiseToPayCount: number;
        disputeCount: number;
        automatedCustomers: any[];
        agentCustomers: any[];
        promiseToPayCustomers: any[];
        disputeCustomers: any[];
        stepData?: Array<{
            step: number;
            customerCount: number;
            invoiceCount: number;
            collectionPeriodCount: number;
        }>;
    };
}

export const fetchDashboardData: QueryFunction<DashboardResponse> = async ({
    queryKey,
}) => {
    const [, { dateRange }] = queryKey as [
        string,
        {
            dateRange?: string; // optional filtering logic
        },
    ];

    try {
        const response = await api.get("/system/dashboard", {
            params: dateRange ? { dateRange } : {},
        });
        return response.data;
    } catch (error: any) {
        console.error("Error fetching dashboard data:", error);
        throw new Error(error?.message || "Failed to fetch dashboard data");
    }
};

/**
 * Shared helper function to get accessible customer IDs for parent view mode
 * This consolidates the logic for finding parent customers, their children, and standalone customers
 *
 * @param account_id - Account ID to filter by
 * @param ownerFilter - Owner filter to apply
 * @param buFilter - Business unit filter to apply
 * @param collectionStatus - Optional collection status filter for child customers (default: "Active")
 * @returns Object containing accessibleChildIds, standaloneCustomerIds, childToParentMap, and allAccessibleCustomerIds
 */
export const getAccessibleCustomersForParentView = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    collectionStatus:
        | "Active"
        | "Inactive"
        | { in: ("Active" | "Inactive")[] } = "Active"
): Promise<{
    accessibleChildIds: number[];
    standaloneCustomerIds: number[];
    childToParentMap: Map<number, number>;
    allAccessibleCustomerIds: number[];
}> => {
    const { prisma } = await import("@/lib/prisma");

    // Build collection status filter
    const collectionStatusFilter =
        typeof collectionStatus === "string"
            ? collectionStatus
            : collectionStatus;

    // Get all parent customers with their children
    // Filter standalone parents by collection status as well
    const parentCustomers = await prisma.customer.findMany({
        where: {
            account_id,
            parent_customer_id: null,
            ...(Object.keys(ownerFilter).length > 0 ? ownerFilter : {}),
            // Filter standalone parents by collection status
            collection_status: collectionStatusFilter as any,
        },
        select: {
            id: true,
            business_unit_id: true,
            ChildCustomers: {
                where: {
                    collection_status: collectionStatusFilter as any,
                },
                select: {
                    id: true,
                    business_unit_id: true,
                },
            },
        },
    });

    // Build child-to-parent map and filter parents and collect child IDs with BU access
    // Also collect standalone customer IDs (customers without children)
    const childToParentMap = new Map<number, number>();
    const accessibleChildIds: number[] = [];
    const standaloneCustomerIds: number[] = [];

    parentCustomers.forEach((parent) => {
        const parentMatchesBU =
            !buFilter ||
            parent.business_unit_id === null ||
            (buFilter.OR &&
                buFilter.OR.some(
                    (f: any) =>
                        f.business_unit_id === parent.business_unit_id ||
                        f.business_unit_id === null ||
                        (f.business_unit_id?.in &&
                            f.business_unit_id.in.includes(
                                parent.business_unit_id
                            ))
                ));

        const hasChildren =
            parent.ChildCustomers && parent.ChildCustomers.length > 0;

        if (hasChildren) {
            // For customers with children, collect child IDs
            const accessibleChildren = (parent.ChildCustomers as any[]).filter(
                (child: any) =>
                    !buFilter ||
                    child.business_unit_id === null ||
                    (buFilter.OR &&
                        buFilter.OR.some(
                            (f: any) =>
                                f.business_unit_id === child.business_unit_id ||
                                f.business_unit_id === null ||
                                (f.business_unit_id?.in &&
                                    f.business_unit_id.in.includes(
                                        child.business_unit_id
                                    ))
                        ))
            );

            if (parentMatchesBU || accessibleChildren.length > 0) {
                accessibleChildren.forEach((child: any) => {
                    accessibleChildIds.push(child.id);
                    childToParentMap.set(child.id, parent.id);
                });
            }
        } else {
            // For standalone customers (no children), include them directly if they match BU
            if (parentMatchesBU) {
                standaloneCustomerIds.push(parent.id);
                childToParentMap.set(parent.id, parent.id); // Map to itself for counting
            }
        }
    });

    const allAccessibleCustomerIds = [
        ...accessibleChildIds,
        ...standaloneCustomerIds,
    ];

    return {
        accessibleChildIds,
        standaloneCustomerIds,
        childToParentMap,
        allAccessibleCustomerIds,
    };
};

// Shared function to get active customers data
export const getActiveCustomersData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<ActiveCustomersData> => {
    const { prisma } = await import("@/lib/prisma");
    const isParentView = viewMode === "parent";

    // Build customer filter with owner and business unit filters using AND
    // Filter by active collection periods, not collection_status
    const customerFilter: any = {
        AND: [
            { account_id },
            {
                CustomerCollectionPeriod: {
                    some: {
                        period_end_date: null, // Active collection period
                    },
                },
            },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    let activeCustomersCount = 0;
    let activeCustomersDetails: any[] = [];

    if (isParentView) {
        // Parent view: count only parent customers with active status
        activeCustomersCount = await prisma.customer.count({
            where: {
                ...customerFilter,
                parent_customer_id: null, // Only parent customers
            },
        });

        // Get parent customers with aggregated data
        activeCustomersDetails = await prisma.customer.findMany({
            where: {
                ...customerFilter,
                parent_customer_id: null, // Only parent customers
            },
            include: {
                Person: true,
                Company: true,
                Owner: true,
                CustomerAggregatedData: {
                    select: {
                        total_outstanding_amount: true,
                        customer_currency1: true,
                        customer_currency2: true,
                        no_of_overdue_invoices: true,
                        active_collection_periods: true,
                    },
                },
            },
        });
    } else {
        // Child view: original logic
        // Get active customers count (for dashboard stat card)
        activeCustomersCount = await prisma.customer.count({
            where: customerFilter,
        });

        // Get active customers with details (for chart details page)
        activeCustomersDetails = await prisma.customer.findMany({
            where: customerFilter,
            include: {
                Person: true,
                Company: true,
                Owner: true,
                CustomerCollectionPeriod: {
                    where: {
                        period_end_date: null, // Only active collection periods
                    },
                    select: {
                        total_outstanding_amount: true,
                        currency: true,
                        promise_to_pay_amount: true,
                        promise_to_pay_date: true,
                        current_category: true,
                        created_at: true,
                    },
                },
                Activity: {
                    orderBy: {
                        created_at: "desc",
                    },
                    take: 10, // Limit to recent activities for performance
                    select: {
                        created_at: true,
                        type: true,
                        content: true,
                    },
                },
            },
        });
    }

    return {
        count: activeCustomersCount,
        details: activeCustomersDetails,
    };
};

// Shared function to get overdue amount data
export const getOverdueAmountData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<OverdueAmountData> => {
    const { prisma } = await import("@/lib/prisma");
    const isParentView = viewMode === "parent";

    // Build customer filter with owner and business unit filters
    // Use AND to properly combine filters when both have OR clauses
    const customerFilter: any = {
        AND: [
            { account_id },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    let overdueAmount = 0;
    let aggregateCustomerCount = 0;
    let parentIds: number[] = []; // Declare outside if block for reuse

    if (isParentView) {
        // For overdue customers, we need to get all parent customers regardless of collection_status
        // because overdue invoices result in open collection periods, but the customer's status might vary
        // Get all parent customers with their children (no collection_status filter)
        const allParentCustomersForOverdue = await prisma.customer.findMany({
            where: {
                account_id,
                parent_customer_id: null,
                ...(Object.keys(ownerFilter).length > 0 ? ownerFilter : {}),
            },
            select: {
                id: true,
                business_unit_id: true,
                ChildCustomers: {
                    select: {
                        id: true,
                        business_unit_id: true,
                    },
                },
            },
        });

        // Build child-to-parent map and filter by BU access
        const childToParentMap = new Map<number, number>();
        const accessibleChildIds: number[] = [];
        const standaloneCustomerIds: number[] = [];
        const parentIdsSet = new Set<number>();

        allParentCustomersForOverdue.forEach((parent) => {
            const parentMatchesBU =
                !buFilter ||
                parent.business_unit_id === null ||
                (buFilter.OR &&
                    buFilter.OR.some(
                        (f: any) =>
                            f.business_unit_id === parent.business_unit_id ||
                            f.business_unit_id === null ||
                            (f.business_unit_id?.in &&
                                f.business_unit_id.in.includes(
                                    parent.business_unit_id
                                ))
                    ));

            const hasChildren =
                parent.ChildCustomers && parent.ChildCustomers.length > 0;

            if (hasChildren) {
                // For customers with children, collect child IDs
                const accessibleChildren = (
                    parent.ChildCustomers as any[]
                ).filter(
                    (child: any) =>
                        !buFilter ||
                        child.business_unit_id === null ||
                        (buFilter.OR &&
                            buFilter.OR.some(
                                (f: any) =>
                                    f.business_unit_id ===
                                    child.business_unit_id ||
                                    f.business_unit_id === null ||
                                    (f.business_unit_id?.in &&
                                        f.business_unit_id.in.includes(
                                            child.business_unit_id
                                        ))
                            ))
                );

                if (parentMatchesBU || accessibleChildren.length > 0) {
                    accessibleChildren.forEach((child: any) => {
                        accessibleChildIds.push(child.id);
                        childToParentMap.set(child.id, parent.id);
                    });
                    // Add parent ID if it has accessible children
                    parentIdsSet.add(parent.id);
                }
            } else {
                // For standalone customers (no children), include them directly if they match BU
                if (parentMatchesBU) {
                    standaloneCustomerIds.push(parent.id);
                    childToParentMap.set(parent.id, parent.id); // Map to itself for counting
                    parentIdsSet.add(parent.id);
                }
            }
        });

        parentIds = Array.from(parentIdsSet);

        // Get all accessible parent customers with aggregated data and their child customers
        const allParentCustomers = await prisma.customer.findMany({
            where: {
                id: { in: parentIds },
                account_id,
            },
            include: {
                CustomerAggregatedData: true,
                ChildCustomers: {
                    select: {
                        id: true,
                        business_unit_id: true,
                        customer_number: true,
                    },
                },
                // Add collection period for standalone customers (those without children)
                // Overdue invoices result in open collection periods
                CustomerCollectionPeriod: {
                    where: {
                        period_end_date: null,
                    },
                    select: {
                        total_outstanding_amount: true,
                        no_of_overdue_invoices: true,
                        currency: true,
                    },
                },
            },
        });

        // Filter for parents with overdue invoices
        const parentCustomers = allParentCustomers.filter((parent) => {
            const hasChildren =
                parent.ChildCustomers && parent.ChildCustomers.length > 0;
            const aggregatedData = parent.CustomerAggregatedData;

            if (hasChildren) {
                // For customers with children, use aggregated data
                const hasOverdue =
                    aggregatedData &&
                    (aggregatedData.no_of_overdue_invoices || 0) > 0;
                return hasOverdue;
            } else {
                // For standalone customers (no children), check collection period
                // Overdue invoices result in open collection periods
                const activePeriod = parent.CustomerCollectionPeriod?.[0];
                const hasOverdue =
                    activePeriod &&
                    ((activePeriod.no_of_overdue_invoices || 0) > 0 ||
                        (activePeriod.total_outstanding_amount || 0) > 0);
                return hasOverdue;
            }
        });

        // Sum up parent customer aggregated data
        overdueAmount = parentCustomers.reduce((sum, parent) => {
            const hasChildren =
                parent.ChildCustomers && parent.ChildCustomers.length > 0;
            const aggregatedData = parent.CustomerAggregatedData;

            if (hasChildren) {
                // Use aggregated data for customers with children
                const amount = aggregatedData?.total_outstanding_amount || 0;
                return sum + amount;
            } else {
                // For standalone customers, use collection period data
                const activePeriod = parent.CustomerCollectionPeriod?.[0];
                const amount = activePeriod?.total_outstanding_amount || 0;
                return sum + amount;
            }
        }, 0);
        aggregateCustomerCount = parentCustomers.length;
    } else {
        // Original child view logic
        // Get overdue amount aggregate (for dashboard stat card)
        const overdueStats = await prisma.customerCollectionPeriod.aggregate({
            where: {
                Customer: customerFilter,
                period_end_date: null,
            },
            _sum: {
                total_outstanding_amount: true,
            },
            _count: {
                customer_id: true,
            },
        });

        overdueAmount = overdueStats._sum.total_outstanding_amount || 0;
        aggregateCustomerCount = overdueStats._count.customer_id || 0;
    }

    // Get customers with active collection periods for chart details page
    let customersWithCollectionPeriods: any[] = [];

    if (isParentView) {
        // For overdue customers details, reuse the same parent IDs we calculated above
        // The parentIdsSet was already built in the previous section
        // We just need to get the parentIds from the scope

        // Get all accessible parent customers with aggregated data for chart details
        // Note: We don't filter by collection_status for parent customers because
        // the parent's status may not be "Active" even if children have active collection periods
        const allParentDetails = await prisma.customer.findMany({
            where: {
                id: { in: parentIds },
                account_id,
            },
            include: {
                Person: true,
                Company: true,
                Owner: true,
                CustomerAggregatedData: {
                    select: {
                        total_outstanding_amount: true,
                        customer_currency1: true,
                        customer_currency2: true,
                        no_of_overdue_invoices: true,
                    },
                },
                ChildCustomers: {
                    select: {
                        id: true,
                        business_unit_id: true,
                    },
                },
                // Add collection period for standalone customers
                // Overdue invoices result in open collection periods
                CustomerCollectionPeriod: {
                    where: {
                        period_end_date: null,
                    },
                    select: {
                        total_outstanding_amount: true,
                        currency: true,
                        promise_to_pay_amount: true,
                        promise_to_pay_date: true,
                        current_category: true,
                        no_of_overdue_invoices: true,
                    },
                },
            },
        });

        // Filter for parents with overdue invoices
        customersWithCollectionPeriods = allParentDetails.filter((parent) => {
            // Check for overdue invoices - handle customers with and without children
            const hasChildren =
                parent.ChildCustomers && parent.ChildCustomers.length > 0;
            const aggregatedData = parent.CustomerAggregatedData;

            let hasOverdue = false;
            if (hasChildren) {
                // For customers with children, use aggregated data
                hasOverdue =
                    !!aggregatedData &&
                    (aggregatedData.no_of_overdue_invoices || 0) > 0;
            } else {
                // For standalone customers, check collection period
                // Overdue invoices result in open collection periods
                const activePeriod = parent.CustomerCollectionPeriod?.[0];
                hasOverdue =
                    !!activePeriod &&
                    ((activePeriod.no_of_overdue_invoices || 0) > 0 ||
                        (activePeriod.total_outstanding_amount || 0) > 0);
            }

            return hasOverdue;
        });
    } else {
        // Original child view logic
        // Filter by active collection periods with outstanding amounts
        const findManyWhere = {
            AND: [
                ...customerFilter.AND,
                {
                    CustomerCollectionPeriod: {
                        some: {
                            period_end_date: null,
                            total_outstanding_amount: {
                                gt: 0,
                            },
                        },
                    },
                },
            ],
        };

        customersWithCollectionPeriods = await prisma.customer.findMany({
            where: findManyWhere,
            include: {
                Person: true,
                Company: true,
                Owner: true,
                CustomerCollectionPeriod: {
                    where: {
                        period_end_date: null,
                    },
                    select: {
                        total_outstanding_amount: true,
                        currency: true,
                        promise_to_pay_amount: true,
                        promise_to_pay_date: true,
                        current_category: true,
                    },
                },
                Invoice: {
                    where: {
                        due_date: {
                            lt: new Date(),
                        },
                    },
                    select: {
                        due_date: true,
                    },
                },
                Activity: {
                    orderBy: { created_at: "desc" },
                    take: 1,
                    select: {
                        created_at: true,
                    },
                },
            },
        });
    }

    return {
        amount: overdueAmount,
        count: aggregateCustomerCount,
        details: customersWithCollectionPeriods,
    };
};

// Shared function to get overdue invoices data
export const getOverdueInvoicesData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any
): Promise<OverdueInvoicesData> => {
    const { prisma } = await import("@/lib/prisma");

    // Build customer filter with owner and business unit filters using AND
    // Filter by active collection periods, not collection_status
    const customerFilter: any = {
        AND: [
            {
                CustomerCollectionPeriod: {
                    some: {
                        period_end_date: null, // Active collection period
                    },
                },
            },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    // Get overdue invoices with details (for chart details page)
    const overdueInvoicesDetails = await prisma.invoice.findMany({
        where: {
            account_id,
            status: { notIn: ["Paid", "Void", "Cancelled"] },
            Customer: customerFilter,
            due_date: {
                lt: new Date(),
            },
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                },
            },
        },
    });

    // Use the same data source for both count and details to ensure consistency
    const overdueInvoices = overdueInvoicesDetails.length;

    return {
        count: overdueInvoices,
        details: overdueInvoicesDetails,
    };
};

// New function specifically for main dashboard - shows last 6 months
export const getCollectedVsPromiseDataForMainDashboard = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any
): Promise<CollectedVsPromiseData> => {
    const { prisma } = await import("@/lib/prisma");

    // Note: In-memory cache removed - dashboard data is now cached in database table

    // Build customer filter with owner and business unit filters using AND
    const customerFilter: any = {
        AND: [
            { account_id },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    // Generate data for the last 6 months from the current month
    const currentDate = new Date();
    const monthQueries: Promise<{
        collected: number;
        promise: number;
        monthName: string;
        monthIndex: number;
    }>[] = [];

    // Generate 6 months of data - prepare all queries in parallel
    for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() - i,
            1
        );

        const monthStart = new Date(
            targetDate.getFullYear(),
            targetDate.getMonth(),
            1
        );
        const monthEnd = new Date(
            targetDate.getFullYear(),
            targetDate.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
        );

        // Get month name
        const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ];
        const monthName = monthNames[targetDate.getMonth()];

        // Store month index for proper sorting
        const monthIndex = i;

        // Create parallel queries for this month
        const monthQuery = Promise.all([
            // Calculate collected amount for this month
            prisma.invoicePayment.aggregate({
                where: {
                    account_id,
                    payment_date: {
                        gte: monthStart,
                        lte: monthEnd,
                    },
                    ...linkedInvoicePaymentWhere,
                },
                _sum: {
                    amount: true,
                },
            }),
            // Calculate promise to pay amount for this month
            prisma.customerCollectionPeriod.aggregate({
                where: {
                    Customer: customerFilter,
                    promise_to_pay_date: {
                        gte: monthStart,
                        lte: monthEnd,
                    },
                    promise_to_pay_amount: {
                        not: null,
                    },
                },
                _sum: {
                    promise_to_pay_amount: true,
                },
            }),
        ]).then(([collectedResult, promiseResult]) => ({
            collected: Math.round(collectedResult._sum?.amount || 0),
            promise: Math.round(promiseResult._sum?.promise_to_pay_amount || 0),
            monthName,
            monthIndex, // Store index for sorting
        }));

        monthQueries.push(monthQuery);
    }

    // Execute month queries in batches to limit concurrent connections (max 3 at a time)
    const monthResults: {
        collected: number;
        promise: number;
        monthName: string;
        monthIndex: number;
    }[] = [];
    for (let i = 0; i < monthQueries.length; i += 3) {
        const batch = monthQueries.slice(i, i + 3);
        const batchResults = await Promise.all(batch);
        monthResults.push(...batchResults);
    }

    // Sort results by month index (descending order: 5, 4, 3, 2, 1, 0)
    const sortedResults = monthResults.sort(
        (a, b) => b.monthIndex - a.monthIndex
    );

    const collectedData = sortedResults.map((r) => r.collected);
    const promiseToPayData = sortedResults.map((r) => r.promise);

    // For the main dashboard, we only need the chart data, not detailed records
    // The totalCollected will be calculated separately for the current month stat card
    const currentMonthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
    );
    const currentMonthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
    );

    // Get collected amount for current month (for dashboard stat card)
    const collectedAmount = await prisma.invoicePayment.aggregate({
        where: {
            account_id,
            payment_date: {
                gte: currentMonthStart,
                lte: currentMonthEnd,
            },
            ...linkedInvoicePaymentWhere,
        },
        _sum: {
            amount: true,
        },
    });

    const totalCollected = collectedAmount._sum?.amount || 0;

    const result: CollectedVsPromiseData = {
        totalCollected,
        chartData: {
            collectedData,
            promiseToPayData,
        },
        details: {
            collectedInvoices: [], // Not needed for main dashboard
            promiseToPayRecords: [], // Not needed for main dashboard
        },
    };

    return result;
};

// Shared function to get collected vs promise data
export const getCollectedVsPromiseData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    period?: string,
    buFilter?: any
): Promise<CollectedVsPromiseData> => {
    const { prisma } = await import("@/lib/prisma");

    // Build customer filter with owner and business unit filters using AND
    const customerFilter: any = {
        AND: [
            { account_id },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    // Parse period parameter (format: YYYY-MM)
    let monthStart: Date;
    let monthEnd: Date;

    if (period) {
        const [year, month] = period.split("-").map(Number);
        // For collected vs promise, use only the specified month
        monthStart = new Date(year, month - 1, 1); // First day of the specified month (month is 0-indexed)
        monthEnd = new Date(year, month, 0, 23, 59, 59, 999); // Last day of the specified month, end of day
    } else {
        // Default to current month if no period specified
        const currentDate = new Date();
        monthStart = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
        ); // First day of current month
        monthEnd = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
        ); // Last day of current month
    }

    // Get collected amount for the specified period (for dashboard stat card)
    // Use the specified period for the stat card, or current month if no period specified
    const now = new Date();
    const statCardMonthStart = period
        ? monthStart
        : new Date(now.getFullYear(), now.getMonth(), 1);
    const statCardMonthEnd = period
        ? monthEnd
        : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Include invoices with a valid payment date in the specified period
    // For collected invoices, use last_payment_date if available, otherwise fall back to modified_at
    // This ensures we capture all collected invoices while prioritizing actual payment dates
    const collectedAmount = await prisma.invoice.aggregate({
        where: {
            account_id,
            status: { in: ["Paid", "Void", "Cancelled"] },
            total_paid: {
                gt: 0,
            },
            OR: [
                {
                    last_payment_date: {
                        gte: statCardMonthStart,
                        lte: statCardMonthEnd,
                    },
                },
                {
                    AND: [
                        { last_payment_date: null },
                        {
                            modified_at: {
                                gte: statCardMonthStart,
                                lte: statCardMonthEnd,
                            },
                        },
                    ],
                },
            ],
        },
        _sum: {
            total_paid: true,
        },
    });

    const totalCollected = collectedAmount._sum?.total_paid || 0;

    // Get collected vs promise data for chart (for dashboard chart)
    // Always show only the specified period month or current month
    const collectedData = [];
    const promiseToPayData = [];

    let chartStartDate: Date;
    let chartEndDate: Date;

    if (period) {
        // For specified period, show only the specified month
        const [year, month] = period.split("-").map(Number);
        const targetMonth = month - 1; // Convert to 0-indexed month

        // Show only the specified month
        chartStartDate = new Date(year, targetMonth, 1);
        chartEndDate = new Date(year, targetMonth + 1, 0, 23, 59, 59, 999);
    } else {
        // Default to current month if no period specified
        const currentDate = new Date();
        chartStartDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
        );
        chartEndDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
        );
    }

    // Generate data for the single month (either specified period or current month)
    const targetDate = new Date(
        chartStartDate.getFullYear(),
        chartStartDate.getMonth(),
        1
    );
    const chartMonthStart = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        1
    );
    const chartMonthEnd = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
    );

    // Calculate collected amount for this month
    // Include invoices with a valid payment date in the specified period
    // For collected invoices, use last_payment_date if available, otherwise fall back to modified_at
    const chartCollectedAmount = await prisma.invoice.aggregate({
        where: {
            account_id,
            status: { in: ["Paid", "Void", "Cancelled"] },
            total_paid: {
                gt: 0,
            },
            OR: [
                {
                    last_payment_date: {
                        gte: chartMonthStart,
                        lte: chartMonthEnd,
                    },
                },
                {
                    AND: [
                        { last_payment_date: null },
                        {
                            modified_at: {
                                gte: chartMonthStart,
                                lte: chartMonthEnd,
                            },
                        },
                    ],
                },
            ],
        },
        _sum: {
            total_paid: true,
        },
    });

    // Calculate promise to pay amount for this month
    const promiseToPayAmount = await prisma.customerCollectionPeriod.aggregate({
        where: {
            Customer: customerFilter,
            promise_to_pay_date: {
                gte: chartMonthStart,
                lte: chartMonthEnd,
            },
            promise_to_pay_amount: {
                not: null,
            },
        },
        _sum: {
            promise_to_pay_amount: true,
        },
    });

    collectedData.push(Math.round(chartCollectedAmount._sum?.total_paid || 0));
    promiseToPayData.push(
        Math.round(promiseToPayAmount._sum?.promise_to_pay_amount || 0)
    );

    // Get detailed data for chart details page
    // Include closed invoices with a payment date in the specified month
    // For collected invoices, use last_payment_date if available, otherwise fall back to modified_at
    const collectedInvoices = await prisma.invoice.findMany({
        where: {
            account_id,
            status: { in: ["Paid", "Void", "Cancelled"] },
            total_paid: {
                gt: 0,
            },
            OR: [
                {
                    last_payment_date: {
                        gte: monthStart,
                        lte: monthEnd,
                    },
                },
                {
                    AND: [
                        { last_payment_date: null },
                        {
                            modified_at: {
                                gte: monthStart,
                                lte: monthEnd,
                            },
                        },
                    ],
                },
            ],
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                    CustomerCollectionPeriod: {
                        where: {
                            period_end_date: null,
                        },
                        select: {
                            customer_currency1: true,
                        },
                    },
                },
            },
        },
    });

    const promiseToPayRecords = await prisma.customerCollectionPeriod.findMany({
        where: {
            Customer: {
                account_id,
                ...ownerFilter,
            },
            promise_to_pay_date: {
                gte: monthStart,
                lte: monthEnd,
            },
            promise_to_pay_amount: {
                not: null,
            },
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                },
            },
        },
    });

    return {
        totalCollected,
        chartData: {
            collectedData,
            promiseToPayData,
        },
        details: {
            collectedInvoices,
            promiseToPayRecords,
        },
    };
};

// Shared function to get aging portfolio data
// Uses the same calculation logic as chart-details page: invoice.amount - invoice.total_paid
// This ensures consistency between dashboard and detailed views
export const getAgingPortfolioData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<AgingPortfolioData> => {
    const { prisma } = await import("@/lib/prisma");
    const { formatAmountWithoutSymbolWhole } = await import(
        "@/utils/stringFormatters"
    );

    const isParentView = viewMode === "parent";

    // Build customer filter with owner and business unit filters using AND
    // Filter by active collection periods, not collection_status
    const customerFilter: any = {
        AND: [
            { account_id },
            {
                CustomerCollectionPeriod: {
                    some: {
                        period_end_date: null, // Active collection period
                    },
                },
            },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(!isParentView && buFilter && Object.keys(buFilter).length > 0
                ? [buFilter]
                : []),
        ],
    };

    const agingRanges = [
        { key: "0_7", min: 0, max: 7 },
        { key: "8_30", min: 8, max: 30 },
        { key: "31_60", min: 31, max: 60 },
        { key: "61_90", min: 61, max: 90 },
        { key: "91_180", min: 91, max: 180 },
        { key: "181_365", min: 181, max: 365 },
        { key: "365_2000", min: 366, max: 9999 },
    ];

    const agingPortfolio = [];
    const today = new Date();

    // Get all overdue customers with their outstanding amounts and due dates to calculate days overdue
    const allOverdueCustomers = await prisma.customer.findMany({
        where: {
            ...customerFilter,
            CustomerCollectionPeriod: {
                some: {
                    period_end_date: null,
                    total_outstanding_amount: {
                        gt: 0,
                    },
                },
            },
            Invoice: {
                some: {
                    status: { notIn: ["Paid", "Void", "Cancelled"] },
                    due_date: {
                        lt: today,
                    },
                },
            },
        },
        include: {
            CustomerCollectionPeriod: {
                where: { period_end_date: null },
                select: {
                    total_outstanding_amount: true,
                },
            },
        },
    });

    // Get all overdue invoices to calculate total portfolio value and reuse for aging ranges
    let allOverdueInvoices;
    let childToParentMap: Map<number, number> | null = null; // Map child customer ID to parent customer ID

    if (isParentView) {
        // For parent view, get all parent customers without filtering by collection_status
        // Collection statistics are based on active collection periods, not collection_status
        const allParentCustomersForCollection = await prisma.customer.findMany({
            where: {
                account_id,
                parent_customer_id: null,
                ...(Object.keys(ownerFilter).length > 0 ? ownerFilter : {}),
            },
            select: {
                id: true,
                business_unit_id: true,
                ChildCustomers: {
                    select: {
                        id: true,
                        business_unit_id: true,
                    },
                },
            },
        });

        // Build child-to-parent map and filter by BU access
        const childToParentMapForCollection = new Map<number, number>();
        const accessibleChildIdsForCollection: number[] = [];
        const standaloneCustomerIdsForCollection: number[] = [];

        allParentCustomersForCollection.forEach((parent) => {
            const parentMatchesBU =
                !buFilter ||
                parent.business_unit_id === null ||
                (buFilter.OR &&
                    buFilter.OR.some(
                        (f: any) =>
                            f.business_unit_id === parent.business_unit_id ||
                            f.business_unit_id === null ||
                            (f.business_unit_id?.in &&
                                f.business_unit_id.in.includes(
                                    parent.business_unit_id
                                ))
                    ));

            const hasChildren =
                parent.ChildCustomers && parent.ChildCustomers.length > 0;

            if (hasChildren) {
                // For customers with children, collect child IDs
                const accessibleChildren = (
                    parent.ChildCustomers as any[]
                ).filter(
                    (child: any) =>
                        !buFilter ||
                        child.business_unit_id === null ||
                        (buFilter.OR &&
                            buFilter.OR.some(
                                (f: any) =>
                                    f.business_unit_id ===
                                    child.business_unit_id ||
                                    f.business_unit_id === null ||
                                    (f.business_unit_id?.in &&
                                        f.business_unit_id.in.includes(
                                            child.business_unit_id
                                        ))
                            ))
                );

                if (parentMatchesBU || accessibleChildren.length > 0) {
                    accessibleChildren.forEach((child: any) => {
                        accessibleChildIdsForCollection.push(child.id);
                        childToParentMapForCollection.set(child.id, parent.id);
                    });
                }
            } else {
                // For standalone customers (no children), include them directly if they match BU
                if (parentMatchesBU) {
                    standaloneCustomerIdsForCollection.push(parent.id);
                    childToParentMapForCollection.set(parent.id, parent.id); // Map to itself for counting
                }
            }
        });

        childToParentMap = childToParentMapForCollection;

        const allAccessibleCustomerIds = [
            ...accessibleChildIdsForCollection,
            ...standaloneCustomerIdsForCollection,
        ];

        allOverdueInvoices = await prisma.invoice.findMany({
            where: {
                account_id,
                status: { notIn: ["Paid", "Void", "Cancelled"] },
                customer_id: {
                    in: allAccessibleCustomerIds,
                },
                due_date: {
                    lt: today,
                },
            },
            select: {
                amount: true,
                due_date: true,
                customer_id: true,
                total_paid: true,
            },
        });
    } else {
        const invoiceFilter: any = {
            account_id,
            status: "Overdue",
            Customer: customerFilter,
            due_date: {
                lt: today, // Only past due dates
            },
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } },
            ],
        };

        allOverdueInvoices = await prisma.invoice.findMany({
            where: invoiceFilter,
            include: {
                Customer: {
                    include: {
                        Person: true,
                        Company: true,
                    },
                },
            },
        });
    }

    // Calculate total portfolio value for percentage calculation using individual invoice outstanding debt
    // This matches the logic used in chart-details page: invoice.amount - invoice.total_paid
    const totalPortfolioValue = allOverdueInvoices.reduce((sum, invoice) => {
        const outstandingAmount =
            (invoice.amount || 0) - (invoice.total_paid || 0);
        return sum + outstandingAmount; // Include negative amounts (credit invoices)
    }, 0);

    // Calculate aging data for chart (matching the original structure)
    for (const range of agingRanges) {
        // Filter invoices by their overdue days for this aging range
        const rangeInvoices = allOverdueInvoices.filter((invoice) => {
            if (!invoice.due_date) return false;
            const daysOverdue = Math.floor(
                (today.getTime() - new Date(invoice.due_date).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            return daysOverdue >= range.min && daysOverdue <= range.max;
        });

        // Calculate outstanding amount for invoices in this aging range using individual invoice outstanding debt
        // This matches the logic used in chart-details page: invoice.amount - invoice.total_paid
        const totalOutstandingAmount = rangeInvoices.reduce((sum, invoice) => {
            const outstandingAmount =
                (invoice.amount || 0) - (invoice.total_paid || 0);
            return sum + outstandingAmount; // Include negative amounts (credit invoices)
        }, 0);

        // Count invoices in this range
        const rangeInvoiceCount = rangeInvoices.length;

        // Count unique customers in this range
        // In parent view, count parent customers instead of child customers
        const rangeCustomerIds = new Set<number>();
        rangeInvoices.forEach((invoice) => {
            if (!invoice.customer_id) return;
            if (isParentView && childToParentMap) {
                // Map child customer ID to parent customer ID
                const parentId = childToParentMap.get(invoice.customer_id);
                if (parentId !== undefined) {
                    rangeCustomerIds.add(parentId);
                }
            } else {
                rangeCustomerIds.add(invoice.customer_id);
            }
        });
        const customerCount = rangeCustomerIds.size;

        // Calculate percentage of total portfolio
        const amountPercentage =
            totalPortfolioValue > 0
                ? `${((totalOutstandingAmount / totalPortfolioValue) * 100).toFixed(2)}%`
                : "0%";

        // Calculate progress (simplified - could be based on collection goals)
        const progress =
            totalOutstandingAmount > 0
                ? Math.min(
                    100,
                    (totalOutstandingAmount / totalPortfolioValue) * 100
                )
                : 0;

        agingPortfolio.push({
            invoices: rangeInvoiceCount,
            accounts: customerCount,
            amount: totalOutstandingAmount, // Sum of individual invoice outstanding debt amounts (amount - total_paid)
            daysRange: range.key,
            amountPercentage,
            progress,
        });
    }

    // Get detailed invoice data for dashboard card display
    const overdueInvoicesWithDetails = await prisma.invoice.findMany({
        where: {
            account_id,
            status: { notIn: ["Paid", "Void", "Cancelled"] },
            Customer: {
                CustomerCollectionPeriod: {
                    some: {
                        period_end_date: null, // Active collection period
                    },
                },
                ...ownerFilter,
            },
            due_date: {
                lt: today,
            },
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                },
            },
        },
        orderBy: {
            due_date: "asc", // Oldest first
        },
        take: 10, // Limit to 10 most overdue invoices for dashboard display
    });

    // Transform to the format expected by the dashboard card
    const invoiceRows = overdueInvoicesWithDetails.map((invoice) => {
        const customer = invoice.Customer;
        const person = customer?.Person;
        const company = customer?.Company;
        const customerName = person
            ? `${person.first_name || ""} ${person.last_name || ""}`.trim()
            : company?.name || "Unknown";

        const daysOverdue = invoice.due_date
            ? Math.floor(
                (today.getTime() - new Date(invoice.due_date).getTime()) /
                (1000 * 60 * 60 * 24)
            )
            : 0;

        return {
            id: invoice.id,
            invoiceNumber: invoice.invoice_number || `INV-${invoice.id}`,
            customerName,
            amount: invoice.amount || 0, // Keep original invoice amount for detailed view
            daysOverdue,
            dueDate: invoice.due_date,
        };
    });

    const result = {
        chartData: agingPortfolio,
        details: invoiceRows, // Now returns invoice-level data instead of customer-level
    };

    return result;
};

// Shared function to get collection efforts phase data
export const getCollectionEffortsPhaseData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<CollectionEffortsPhaseData> => {
    const { prisma } = await import("@/lib/prisma");
    const isParentView = viewMode === "parent";

    // Build customer filter with owner and business unit filters using AND
    let customerFilter: any;
    const accessibleChildIds: number[] = [];
    let standaloneCustomerIds: number[] = [];
    let allAccessibleCustomerIds: number[] = [];
    let childToParentMap: Map<number, number> | null = null;

    if (isParentView) {
        // For collection statistics, we need to get all parent customers regardless of collection_status
        // because collection statistics are based on active collection periods, not customer status
        // Get all parent customers with their children (no collection_status filter)
        const allParentCustomersForCollection = await prisma.customer.findMany({
            where: {
                account_id,
                parent_customer_id: null,
                ...(Object.keys(ownerFilter).length > 0 ? ownerFilter : {}),
            },
            select: {
                id: true,
                business_unit_id: true,
                ChildCustomers: {
                    select: {
                        id: true,
                        business_unit_id: true,
                    },
                },
            },
        });

        // Build child-to-parent map and filter by BU access
        const childToParentMapForCollection = new Map<number, number>();
        const accessibleChildIdsForCollection: number[] = [];
        const standaloneCustomerIdsForCollection: number[] = [];
        const parentIdsSetForCollection = new Set<number>();

        allParentCustomersForCollection.forEach((parent) => {
            const parentMatchesBU =
                !buFilter ||
                parent.business_unit_id === null ||
                (buFilter.OR &&
                    buFilter.OR.some(
                        (f: any) =>
                            f.business_unit_id === parent.business_unit_id ||
                            f.business_unit_id === null ||
                            (f.business_unit_id?.in &&
                                f.business_unit_id.in.includes(
                                    parent.business_unit_id
                                ))
                    ));

            const hasChildren =
                parent.ChildCustomers && parent.ChildCustomers.length > 0;

            if (hasChildren) {
                // For customers with children, collect child IDs
                const accessibleChildren = (
                    parent.ChildCustomers as any[]
                ).filter(
                    (child: any) =>
                        !buFilter ||
                        child.business_unit_id === null ||
                        (buFilter.OR &&
                            buFilter.OR.some(
                                (f: any) =>
                                    f.business_unit_id ===
                                    child.business_unit_id ||
                                    f.business_unit_id === null ||
                                    (f.business_unit_id?.in &&
                                        f.business_unit_id.in.includes(
                                            child.business_unit_id
                                        ))
                            ))
                );

                if (parentMatchesBU || accessibleChildren.length > 0) {
                    accessibleChildren.forEach((child: any) => {
                        accessibleChildIdsForCollection.push(child.id);
                        childToParentMapForCollection.set(child.id, parent.id);
                    });
                    // Add parent ID if it has accessible children
                    parentIdsSetForCollection.add(parent.id);
                }
            } else {
                // For standalone customers (no children), include them directly if they match BU
                if (parentMatchesBU) {
                    standaloneCustomerIdsForCollection.push(parent.id);
                    childToParentMapForCollection.set(parent.id, parent.id); // Map to itself for counting
                    parentIdsSetForCollection.add(parent.id);
                }
            }
        });

        childToParentMap = childToParentMapForCollection;

        allAccessibleCustomerIds = [
            ...accessibleChildIdsForCollection,
            ...standaloneCustomerIdsForCollection,
        ];
        standaloneCustomerIds = standaloneCustomerIdsForCollection;

        // For parent view, filter by accessible child IDs OR standalone customer IDs
        // Don't filter by collection_status - collection statistics are based on active collection periods
        customerFilter = {
            AND: [{ account_id }, { id: { in: allAccessibleCustomerIds } }],
        };
    } else {
        // Child view: filter by active collection periods, not collection_status
        customerFilter = {
            AND: [
                { account_id },
                {
                    CustomerCollectionPeriod: {
                        some: {
                            period_end_date: null, // Active collection period
                        },
                    },
                },
                ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
                ...(buFilter && Object.keys(buFilter).length > 0
                    ? [buFilter]
                    : []),
            ],
        };
    }

    // Get customers in different collection phases with enhanced details
    const automatedCustomers = await prisma.customer.findMany({
        where: {
            ...customerFilter,
            // Customers with current_category "Automated" in their active collection period
            CustomerCollectionPeriod: {
                some: {
                    current_category: "Automated",
                    period_end_date: null,
                },
            },
        },
        include: {
            CustomerCollectionPeriod: {
                where: { period_end_date: null },
                select: {
                    total_outstanding_amount: true,
                    last_call: true,
                    follow_up_time: true,
                    promise_to_pay_amount: true,
                    no_of_overdue_invoices: true,
                },
            },
        },
    });

    const agentCustomers = await prisma.customer.findMany({
        where: {
            ...customerFilter,
            // Customers with current_category "Agent" in their active collection period
            CustomerCollectionPeriod: {
                some: {
                    current_category: "Agent",
                    period_end_date: null,
                },
            },
        },
        include: {
            CustomerCollectionPeriod: {
                where: { period_end_date: null },
                select: {
                    total_outstanding_amount: true,
                    last_call: true,
                    follow_up_time: true,
                    promise_to_pay_amount: true,
                    current_category: true,
                    no_of_overdue_invoices: true,
                },
            },
        },
    });

    const promiseToPayCustomers = await prisma.customer.findMany({
        where: {
            ...customerFilter,
            // Customers with current_category "Promise_to_pay" in their active collection period
            CustomerCollectionPeriod: {
                some: {
                    current_category: "Promise_to_pay",
                    period_end_date: null,
                },
            },
        },
        include: {
            CustomerCollectionPeriod: {
                where: { period_end_date: null },
                select: {
                    total_outstanding_amount: true,
                    last_call: true,
                    follow_up_time: true,
                    promise_to_pay_amount: true,
                    no_of_overdue_invoices: true,
                },
            },
        },
    });

    const disputeCustomers = await prisma.customer.findMany({
        where: {
            ...customerFilter,
            // Customers with current_category "Dispute" in their active collection period
            CustomerCollectionPeriod: {
                some: {
                    current_category: "Dispute",
                    period_end_date: null,
                },
            },
        },
        include: {
            CustomerCollectionPeriod: {
                where: { period_end_date: null },
                select: {
                    total_outstanding_amount: true,
                    last_call: true,
                    follow_up_time: true,
                    promise_to_pay_amount: true,
                    no_of_overdue_invoices: true,
                },
            },
        },
    });

    const legalCustomers = await prisma.customer.findMany({
        where: {
            ...customerFilter,
            CustomerCollectionPeriod: {
                some: {
                    current_category: "Legal",
                    period_end_date: null,
                },
            },
        },
        include: {
            CustomerCollectionPeriod: {
                where: { period_end_date: null },
                select: {
                    total_outstanding_amount: true,
                    last_call: true,
                    follow_up_time: true,
                    promise_to_pay_amount: true,
                    no_of_overdue_invoices: true,
                },
            },
        },
    });

    // Calculate counts from the detailed data
    let automatedCount: number;
    let agentCount: number;
    let promiseToPayCount: number;
    let disputeCount: number;
    let legalCount: number;

    if (isParentView && childToParentMap) {
        // For parent view, count unique parent customers
        // Count unique parents for each phase
        const map = childToParentMap;
        const automatedParentIds = new Set<number>();
        automatedCustomers.forEach((customer) => {
            const parentId = map.get(customer.id);
            if (parentId) {
                automatedParentIds.add(parentId);
            } else {
                // If not in map, check if it's a standalone customer
                if (standaloneCustomerIds.includes(customer.id)) {
                    automatedParentIds.add(customer.id);
                }
            }
        });
        automatedCount = automatedParentIds.size;

        const agentParentIds = new Set<number>();
        const agentCustomerDetails: any[] = [];

        agentCustomers.forEach((customer) => {
            const parentId = map.get(customer.id);
            if (parentId) {
                agentParentIds.add(parentId);
                agentCustomerDetails.push({
                    customerId: customer.id,
                    parentId: parentId,
                    isStandalone: false,
                });
            } else {
                // If not in map, check if it's a standalone customer
                // Standalone customers should be in the map mapped to themselves,
                // but as a safety check, if customer.id is in standaloneCustomerIds, use it
                if (standaloneCustomerIds.includes(customer.id)) {
                    agentParentIds.add(customer.id);
                    agentCustomerDetails.push({
                        customerId: customer.id,
                        parentId: customer.id,
                        isStandalone: true,
                    });
                } else {
                    // Customer not found in map and not in standalone list
                    agentCustomerDetails.push({
                        customerId: customer.id,
                        parentId: null,
                        isStandalone: false,
                        warning:
                            "Customer not found in childToParentMap and not in standaloneCustomerIds",
                    });
                }
            }
        });
        agentCount = agentParentIds.size;

        const promiseToPayParentIds = new Set<number>();
        promiseToPayCustomers.forEach((customer) => {
            const parentId = map.get(customer.id);
            if (parentId) {
                promiseToPayParentIds.add(parentId);
            } else {
                // If not in map, check if it's a standalone customer
                if (standaloneCustomerIds.includes(customer.id)) {
                    promiseToPayParentIds.add(customer.id);
                }
            }
        });
        promiseToPayCount = promiseToPayParentIds.size;

        const disputeParentIds = new Set<number>();
        disputeCustomers.forEach((customer) => {
            const parentId = map.get(customer.id);
            if (parentId) {
                disputeParentIds.add(parentId);
            } else {
                // If not in map, check if it's a standalone customer
                if (standaloneCustomerIds.includes(customer.id)) {
                    disputeParentIds.add(customer.id);
                }
            }
        });
        disputeCount = disputeParentIds.size;

        const legalParentIds = new Set<number>();
        legalCustomers.forEach((customer) => {
            const parentId = map.get(customer.id);
            if (parentId) {
                legalParentIds.add(parentId);
            } else {
                // If not in map, check if it's a standalone customer
                if (standaloneCustomerIds.includes(customer.id)) {
                    legalParentIds.add(customer.id);
                }
            }
        });
        legalCount = legalParentIds.size;
    } else {
        // Child view: count customers directly
        automatedCount = automatedCustomers.length;
        agentCount = agentCustomers.length;
        promiseToPayCount = promiseToPayCustomers.length;
        disputeCount = disputeCustomers.length;
        legalCount = legalCustomers.length;
    }

    // Calculate total for percentage calculation
    const totalRecords =
        automatedCount +
        agentCount +
        promiseToPayCount +
        disputeCount +
        legalCount;

    // Calculate percentages for the donut chart
    const automatedPercentage =
        totalRecords > 0
            ? Math.round((automatedCount / totalRecords) * 100)
            : 0;
    const agentPercentage =
        totalRecords > 0 ? Math.round((agentCount / totalRecords) * 100) : 0;
    const promiseToPayPercentage =
        totalRecords > 0
            ? Math.round((promiseToPayCount / totalRecords) * 100)
            : 0;
    const disputePercentage =
        totalRecords > 0 ? Math.round((disputeCount / totalRecords) * 100) : 0;
    const legalPercentage =
        totalRecords > 0 ? Math.round((legalCount / totalRecords) * 100) : 0;

    // Calculate amounts for dispute and promise to pay
    const disputeAmount = disputeCustomers.reduce((sum, customer) => {
        const collectionPeriod = customer.CustomerCollectionPeriod[0];
        return sum + (collectionPeriod?.total_outstanding_amount || 0);
    }, 0);

    const promiseToPayAmount = promiseToPayCustomers.reduce((sum, customer) => {
        const collectionPeriod = customer.CustomerCollectionPeriod[0];
        return sum + (collectionPeriod?.promise_to_pay_amount || 0);
    }, 0);

    // Calculate invoice counts for each category using no_of_overdue_invoices from collection period
    // This matches the source of total_outstanding_amount and ensures consistency
    const automatedInvoiceCount = automatedCustomers.reduce((sum, customer) => {
        const collectionPeriod = customer.CustomerCollectionPeriod?.[0];
        return sum + (collectionPeriod?.no_of_overdue_invoices || 0);
    }, 0);
    const agentInvoiceCount = agentCustomers.reduce((sum, customer) => {
        const collectionPeriod = customer.CustomerCollectionPeriod?.[0];
        return sum + (collectionPeriod?.no_of_overdue_invoices || 0);
    }, 0);
    const promiseToPayInvoiceCount = promiseToPayCustomers.reduce(
        (sum, customer) => {
            const collectionPeriod = customer.CustomerCollectionPeriod?.[0];
            return sum + (collectionPeriod?.no_of_overdue_invoices || 0);
        },
        0
    );
    // For dispute invoice count, count invoices directly associated with disputes via DisputeInvoice table
    // This is different from other categories - we want only invoices in disputes, not all overdue invoices
    // Use the same logic as calculateDisputeStatsForDashboard to ensure consistency
    // Filter disputes by Customer (account_id and owner) matching the same filters used in dispute list page
    let disputeInvoiceCount = 0;

    // Build customer filter for disputes - same structure as calculateDisputeStatsForDashboard
    // The ownerFilter already has the correct structure: { OR: [{ owner_id: userId }, { owner_id: null }] } or {}
    const customerFilterForDisputes: any = {
        account_id,
    };

    // Apply owner filter if present
    if (Object.keys(ownerFilter).length > 0) {
        if (ownerFilter.OR) {
            // ownerFilter has OR structure: { OR: [{ owner_id: userId }, { owner_id: null }] }
            customerFilterForDisputes.OR = ownerFilter.OR;
        } else if (ownerFilter.owner_id) {
            // ownerFilter has simple owner_id
            customerFilterForDisputes.OR = [
                { owner_id: ownerFilter.owner_id },
                { owner_id: null },
            ];
        }
    }

    // Apply BU filter if present
    if (buFilter && Object.keys(buFilter).length > 0) {
        if (customerFilterForDisputes.OR) {
            // Combine owner filter (OR) with BU filter using AND
            customerFilterForDisputes.AND = [
                { account_id },
                { OR: customerFilterForDisputes.OR },
                buFilter,
            ];
            delete customerFilterForDisputes.OR;
        } else {
            Object.assign(customerFilterForDisputes, buFilter);
        }
    }

    const disputeInvoices = await prisma.disputeInvoice.findMany({
        where: {
            CustomerDispute: {
                Customer: customerFilterForDisputes,
                dispute_status: {
                    in: ["New", "Under_Review", "Awaiting_Update"],
                },
            },
        },
        select: {
            invoice_id: true,
        },
    });

    // Count unique invoice IDs
    disputeInvoiceCount = new Set(disputeInvoices.map((di) => di.invoice_id))
        .size;
    const legalInvoiceCount = legalCustomers.reduce((sum, customer) => {
        const collectionPeriod = customer.CustomerCollectionPeriod?.[0];
        return sum + (collectionPeriod?.no_of_overdue_invoices || 0);
    }, 0);

    const result = {
        chartData: {
            series: [
                automatedPercentage,
                agentPercentage,
                promiseToPayPercentage,
                disputePercentage,
                legalPercentage,
            ],
            stats: [
                { label: "Automated", value: automatedCount.toString() },
                { label: "Agent", value: agentCount.toString() },
                {
                    label: "Promise to Pay",
                    value: promiseToPayCount.toString(),
                },
                { label: "Dispute", value: disputeCount.toString() },
                { label: "Legal", value: legalCount.toString() },
            ],
        },
        details: {
            automatedCount,
            agentCount,
            promiseToPayCount,
            disputeCount,
            legalCount,
            automatedInvoiceCount,
            agentInvoiceCount,
            promiseToPayInvoiceCount,
            disputeInvoiceCount,
            legalInvoiceCount,
            automatedCustomers,
            agentCustomers,
            promiseToPayCustomers,
            disputeCustomers,
            legalCustomers,
        },
    };

    // Log collection efforts phase calculation for debugging
    const logData = {
        account_id,
        disputeCount,
        disputeAmount,
        disputeCustomersCount: disputeCustomers.length,
        disputeCustomerIds: disputeCustomers.map((c) => c.id).slice(0, 10), // First 10 IDs
        promiseToPayCount,
        promiseToPayAmount,
        promiseToPayCustomersCount: promiseToPayCustomers.length,
        promiseToPayCustomerIds: promiseToPayCustomers
            .map((c) => c.id)
            .slice(0, 10), // First 10 IDs
        automatedCount,
        agentCount,
        customerFilterApplied:
            Object.keys(ownerFilter).length > 0 ||
            (buFilter && Object.keys(buFilter).length > 0),
    };

    return result;
};

// Shared function to get automated phase split data
export const getAutomatedPhaseSplitData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<AutomatedPhaseSplitData> => {
    const { prisma } = await import("@/lib/prisma");
    const isParentView = viewMode === "parent";

    // Build customer filter with owner and business unit filters using AND
    let customerFilter: any;
    let childToParentMap: Map<number, number> | null = null;

    if (isParentView) {
        // For parent view, get all parent customers without filtering by collection_status
        // Collection statistics are based on active collection periods, not collection_status
        const allParentCustomersForCollection = await prisma.customer.findMany({
            where: {
                account_id,
                parent_customer_id: null,
                ...(Object.keys(ownerFilter).length > 0 ? ownerFilter : {}),
            },
            select: {
                id: true,
                business_unit_id: true,
                ChildCustomers: {
                    select: {
                        id: true,
                        business_unit_id: true,
                    },
                },
            },
        });

        // Build child-to-parent map and filter by BU access
        const childToParentMapForCollection = new Map<number, number>();
        const accessibleChildIdsForCollection: number[] = [];
        const standaloneCustomerIdsForCollection: number[] = [];

        allParentCustomersForCollection.forEach((parent) => {
            const parentMatchesBU =
                !buFilter ||
                parent.business_unit_id === null ||
                (buFilter.OR &&
                    buFilter.OR.some(
                        (f: any) =>
                            f.business_unit_id === parent.business_unit_id ||
                            f.business_unit_id === null ||
                            (f.business_unit_id?.in &&
                                f.business_unit_id.in.includes(
                                    parent.business_unit_id
                                ))
                    ));

            const hasChildren =
                parent.ChildCustomers && parent.ChildCustomers.length > 0;

            if (hasChildren) {
                // For customers with children, collect child IDs
                const accessibleChildren = (
                    parent.ChildCustomers as any[]
                ).filter(
                    (child: any) =>
                        !buFilter ||
                        child.business_unit_id === null ||
                        (buFilter.OR &&
                            buFilter.OR.some(
                                (f: any) =>
                                    f.business_unit_id ===
                                    child.business_unit_id ||
                                    f.business_unit_id === null ||
                                    (f.business_unit_id?.in &&
                                        f.business_unit_id.in.includes(
                                            child.business_unit_id
                                        ))
                            ))
                );

                if (parentMatchesBU || accessibleChildren.length > 0) {
                    accessibleChildren.forEach((child: any) => {
                        accessibleChildIdsForCollection.push(child.id);
                        childToParentMapForCollection.set(child.id, parent.id);
                    });
                }
            } else {
                // For standalone customers (no children), include them directly if they match BU
                if (parentMatchesBU) {
                    standaloneCustomerIdsForCollection.push(parent.id);
                    childToParentMapForCollection.set(parent.id, parent.id); // Map to itself for counting
                }
            }
        });

        childToParentMap = childToParentMapForCollection;

        const allAccessibleCustomerIds = [
            ...accessibleChildIdsForCollection,
            ...standaloneCustomerIdsForCollection,
        ];

        // For parent view, filter by accessible child IDs OR standalone customer IDs
        // Filter by active collection periods, not collection_status
        customerFilter = {
            AND: [
                { account_id },
                {
                    CustomerCollectionPeriod: {
                        some: {
                            period_end_date: null, // Active collection period
                        },
                    },
                },
                { id: { in: allAccessibleCustomerIds } },
            ],
        };
    } else {
        // Child view: filter by active collection periods, not collection_status
        customerFilter = {
            AND: [
                { account_id },
                {
                    CustomerCollectionPeriod: {
                        some: {
                            period_end_date: null, // Active collection period
                        },
                    },
                },
                ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
                ...(buFilter && Object.keys(buFilter).length > 0
                    ? [buFilter]
                    : []),
            ],
        };
    }

    // Get all open collection periods with Automated category, grouped by step
    const automatedCollectionPeriods =
        await prisma.customerCollectionPeriod.findMany({
            where: {
                Customer: customerFilter,
                current_category: "Automated",
                period_end_date: null,
            },
            include: {
                Customer: {
                    include: {
                        Invoice: {
                            where: {
                                status: { notIn: ["Paid", "Void", "Cancelled"] },
                            },
                            select: {
                                id: true,
                            },
                        },
                    },
                },
            },
        });

    // Group collection periods by last_automated_step
    // last_automated_step can be null (not started), 0 (before step 1), or 1, 2, 3, etc.
    const stepGroups = new Map<
        number,
        {
            collectionPeriods: typeof automatedCollectionPeriods;
            customerIds: Set<number>;
            invoiceCount: number;
        }
    >();

    automatedCollectionPeriods.forEach((period) => {
        // Use last_automated_step, defaulting to 0 if null (before step 1)
        const step = period.last_automated_step ?? 0;

        if (!stepGroups.has(step)) {
            stepGroups.set(step, {
                collectionPeriods: [],
                customerIds: new Set(),
                invoiceCount: 0,
            });
        }

        const group = stepGroups.get(step)!;
        group.collectionPeriods.push(period);

        // In parent view, map child customer to parent customer
        if (isParentView && childToParentMap) {
            const parentId = childToParentMap.get(period.customer_id);
            if (parentId !== undefined) {
                group.customerIds.add(parentId);
            } else {
                // Standalone customer
                group.customerIds.add(period.customer_id);
            }
        } else {
            group.customerIds.add(period.customer_id);
        }

        // Count invoices for this collection period
        group.invoiceCount += period.Customer.Invoice.length;
    });

    // Sort steps and build chart data
    const sortedSteps = Array.from(stepGroups.keys()).sort((a, b) => a - b);
    const customerCounts: number[] = [];
    const invoiceCounts: number[] = [];

    sortedSteps.forEach((step) => {
        const group = stepGroups.get(step)!;
        customerCounts.push(group.customerIds.size);
        invoiceCounts.push(group.invoiceCount);
    });

    // Get collection efforts data for details
    const collectionEffortsData = await getCollectionEffortsPhaseData(
        account_id,
        ownerFilter,
        buFilter,
        viewMode
    );

    const result = {
        chartData: {
            series: [
                {
                    name: "Customers",
                    type: "column",
                    data: customerCounts,
                },
                {
                    name: "Invoices",
                    type: "column",
                    data: invoiceCounts,
                },
            ],
            categories: sortedSteps.map(
                (step) => `Step ${step === 0 ? "0 (Not Started)" : step}`
            ),
        },
        details: {
            stepData: sortedSteps.map((step) => {
                const group = stepGroups.get(step)!;
                return {
                    step,
                    customerCount: group.customerIds.size,
                    invoiceCount: group.invoiceCount,
                    collectionPeriodCount: group.collectionPeriods.length,
                };
            }),
            // Use invoice counts from collectionEffortsData (spread first, then override automatedInvoiceCount)
            ...collectionEffortsData.details,
            // Override automatedInvoiceCount with the sum from step data
            automatedInvoiceCount: invoiceCounts.reduce(
                (sum, count) => sum + count,
                0
            ),
            // Map disputeInvoiceCount to disputePhaseInvoiceCount for API compatibility
            disputePhaseInvoiceCount:
                collectionEffortsData.details.disputeInvoiceCount || 0,
        },
    };

    return result;
};

// Due statistics functions
export const getTotalDueData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any
): Promise<DueAmountData> => {
    const { prisma } = await import("@/lib/prisma");

    // Build customer filter with owner and business unit filters using AND
    const customerFilter: any = {
        AND: [
            { collection_status: { in: ["Active", "Inactive"] } },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    // Get all outstanding invoices for details first
    const dueInvoices = await prisma.invoice.findMany({
        where: {
            account_id,
            Customer: customerFilter,
            // Only include invoices that are due (not overdue) - use status_id instead of date
            status: "Due",
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } },
            ],
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                },
            },
        },
        orderBy: {
            due_date: "asc",
        },
    });

    // Calculate total due amount using outstanding_debt primarily, fallback to customer_outstanding_debt
    const totalDueAmount = dueInvoices.reduce((sum, invoice) => {
        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        // Use outstanding_debt if not 0, otherwise use customer_outstanding_debt (includes negative amounts/credits)
        return (
            sum +
            (outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt)
        );
    }, 0);

    return {
        amount: totalDueAmount,
        details: dueInvoices,
    };
};

export const getDueTodayData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any
): Promise<DueAmountData> => {
    const { prisma } = await import("@/lib/prisma");

    // Build customer filter with owner and business unit filters using AND
    const customerFilter: any = {
        AND: [
            { collection_status: { in: ["Active", "Inactive"] } },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    const today = new Date();
    const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );
    const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
    );

    const dueTodayInvoices = await prisma.invoice.findMany({
        where: {
            account_id,
            Customer: customerFilter,
            status: "Due",
            due_date: {
                gte: startOfDay,
                lt: endOfDay,
            },
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } },
            ],
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                },
            },
        },
        orderBy: {
            due_date: "asc",
        },
    });

    // Calculate due today amount using outstanding_debt primarily, fallback to customer_outstanding_debt
    const dueTodayAmount = dueTodayInvoices.reduce((sum, invoice) => {
        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        // Use outstanding_debt if not 0, otherwise use customer_outstanding_debt (includes negative amounts/credits)
        return (
            sum +
            (outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt)
        );
    }, 0);

    return {
        amount: dueTodayAmount,
        details: dueTodayInvoices,
    };
};

export const getDueThisWeekData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any
): Promise<DueAmountData> => {
    const { prisma } = await import("@/lib/prisma");

    // Build customer filter with owner and business unit filters using AND
    const customerFilter: any = {
        AND: [
            { collection_status: { in: ["Active", "Inactive"] } },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7); // End of current week

    // For "Due This Week", we only want invoices due from today onwards, not past dates
    const queryStartDate = today;

    const dueThisWeekInvoices = await prisma.invoice.findMany({
        where: {
            account_id,
            Customer: customerFilter,
            status: "Due",
            due_date: {
                gte: queryStartDate, // Only include invoices due from today onwards
                lt: endOfWeek,
            },
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } },
            ],
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                },
            },
        },
        orderBy: {
            due_date: "asc",
        },
    });

    // Calculate due this week amount using outstanding_debt primarily, fallback to customer_outstanding_debt
    const dueThisWeekAmount = dueThisWeekInvoices.reduce((sum, invoice) => {
        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        // Use outstanding_debt if not 0, otherwise use customer_outstanding_debt (includes negative amounts/credits)
        return (
            sum +
            (outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt)
        );
    }, 0);

    return {
        amount: dueThisWeekAmount,
        details: dueThisWeekInvoices,
    };
};

export const getDueThisMonthData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any
): Promise<DueAmountData> => {
    const { prisma } = await import("@/lib/prisma");

    // Build customer filter with owner and business unit filters using AND
    const customerFilter: any = {
        AND: [
            { collection_status: { in: ["Active", "Inactive"] } },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
    );

    // For "due this month", we always want invoices due from today until end of month
    // This ensures we only show future due dates, not past ones
    const queryStartDate = today;

    const dueThisMonthInvoices = await prisma.invoice.findMany({
        where: {
            account_id,
            Customer: customerFilter,
            status: "Due",
            due_date: {
                gte: queryStartDate,
                lte: endOfMonth,
            },
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } },
            ],
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                },
            },
        },
        orderBy: {
            due_date: "asc",
        },
    });

    // Calculate due this month amount using outstanding_debt primarily, fallback to customer_outstanding_debt
    const dueThisMonthAmount = dueThisMonthInvoices.reduce((sum, invoice) => {
        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        // Use outstanding_debt if not 0, otherwise use customer_outstanding_debt (includes negative amounts/credits)
        return (
            sum +
            (outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt)
        );
    }, 0);

    return {
        amount: dueThisMonthAmount,
        details: dueThisMonthInvoices,
    };
};

export const getDueNextMonthData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any
): Promise<DueAmountData> => {
    const { prisma } = await import("@/lib/prisma");

    // Build customer filter with owner and business unit filters using AND
    const customerFilter: any = {
        AND: [
            { collection_status: { in: ["Active", "Inactive"] } },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    const today = new Date();
    const startOfNextMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        1
    );
    const endOfNextMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 2,
        1
    );

    const dueNextMonthInvoices = await prisma.invoice.findMany({
        where: {
            account_id,
            Customer: customerFilter,
            status: "Due",
            due_date: {
                gte: startOfNextMonth,
                lt: endOfNextMonth,
            },
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } },
            ],
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                },
            },
        },
        orderBy: {
            due_date: "asc",
        },
    });

    // Calculate due next month amount using outstanding_debt primarily, fallback to customer_outstanding_debt
    const dueNextMonthAmount = dueNextMonthInvoices.reduce((sum, invoice) => {
        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        // Use outstanding_debt if not 0, otherwise use customer_outstanding_debt (includes negative amounts/credits)
        return (
            sum +
            (outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt)
        );
    }, 0);

    return {
        amount: dueNextMonthAmount,
        details: dueNextMonthInvoices,
    };
};

// Function to get invoices by customer data (Top 10)
export const getInvoicesByCustomerData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<CustomerData[]> => {
    const { prisma } = await import("@/lib/prisma");
    const isParentView = viewMode === "parent";

    if (isParentView) {
        // For parent view, aggregate from children's due invoices
        const parentWhere = {
            AND: [
                { account_id },
                ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
                { parent_customer_id: null }, // Only parent customers
            ],
        };

        const parentCustomers = await prisma.customer.findMany({
            where: parentWhere,
            select: {
                id: true,
                type: true,
                business_unit_id: true,
                Person: {
                    select: {
                        first_name: true,
                        last_name: true,
                        full_name: true,
                    },
                },
                Company: {
                    select: {
                        name: true,
                    },
                },
                ChildCustomers: {
                    select: {
                        id: true,
                        business_unit_id: true,
                        Invoice: {
                            where: {
                                status: "Due",
                                OR: [
                                    { outstanding_debt: { not: 0 } },
                                    { customer_outstanding_debt: { not: 0 } },
                                ],
                            },
                            select: {
                                outstanding_debt: true,
                                customer_outstanding_debt: true,
                            },
                        },
                    },
                },
            },
        });

        // Filter for parents with BU access and calculate due amounts from children
        const parentTotals = parentCustomers
            .map((parent) => {
                // Check business unit access
                const parentMatchesBU =
                    !buFilter ||
                    parent.business_unit_id === null ||
                    (buFilter.OR &&
                        buFilter.OR.some(
                            (f: any) =>
                                f.business_unit_id ===
                                parent.business_unit_id ||
                                f.business_unit_id === null ||
                                (f.business_unit_id?.in &&
                                    f.business_unit_id.in.includes(
                                        parent.business_unit_id
                                    ))
                        ));

                // Filter children by BU access
                const accessibleChildren =
                    parent.ChildCustomers?.filter(
                        (child) =>
                            !buFilter ||
                            child.business_unit_id === null ||
                            (buFilter.OR &&
                                buFilter.OR.some(
                                    (f: any) =>
                                        f.business_unit_id ===
                                        child.business_unit_id ||
                                        f.business_unit_id === null ||
                                        (f.business_unit_id?.in &&
                                            f.business_unit_id.in.includes(
                                                child.business_unit_id
                                            ))
                                ))
                    ) || [];

                const hasBUAccess =
                    parentMatchesBU || accessibleChildren.length > 0;

                if (!hasBUAccess) {
                    return null;
                }

                // Calculate total due amount from accessible children's invoices
                const totalDueAmount = accessibleChildren.reduce(
                    (sum, child) => {
                        const childDueAmount = child.Invoice.reduce(
                            (childSum, invoice) => {
                                const outstandingDebt =
                                    invoice.outstanding_debt || 0;
                                const customerOutstandingDebt =
                                    invoice.customer_outstanding_debt || 0;
                                const amount =
                                    outstandingDebt !== 0
                                        ? outstandingDebt
                                        : customerOutstandingDebt;
                                return childSum + amount;
                            },
                            0
                        );
                        return sum + childDueAmount;
                    },
                    0
                );

                const customerName =
                    parent.type === "Person"
                        ? parent.Person?.full_name ||
                        `${parent.Person?.first_name || ""} ${parent.Person?.last_name || ""}`.trim() ||
                        "Unknown"
                        : parent.Company?.name || "Unknown";

                return {
                    name: customerName,
                    amount: totalDueAmount,
                };
            })
            .filter((item) => item !== null && item.amount > 0) as {
                name: string;
                amount: number;
            }[];

        // Sort by amount descending and take top 10
        const customerData = parentTotals
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);

        // Calculate total amount for percentage calculation
        const totalAmount = customerData.reduce(
            (sum, item) => sum + item.amount,
            0
        );

        // Generate theme-based colors
        const themeColors = [
            "#6B46C1",
            "#9F7AEA",
            "#4A5568",
            "#718096",
            "#805AD5",
            "#B794F4",
            "#2D3748",
            "#A0AEC0",
            "#553C9A",
            "#D6BCFA",
        ];

        const result = customerData.map((item, index) => ({
            customer: item.name,
            amount: item.amount,
            percentage:
                totalAmount > 0
                    ? Math.round((item.amount / totalAmount) * 100 * 100) / 100
                    : 0,
            color: themeColors[index % themeColors.length],
        }));

        return result;
    }

    // Original child view logic
    // Build customer filter with owner and business unit filters using AND
    const customerFilter: any = {
        AND: [
            { collection_status: { in: ["Active", "Inactive"] } },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    // Get due invoices grouped by customer
    const dueInvoices = await prisma.invoice.findMany({
        where: {
            account_id,
            Customer: customerFilter,
            // Only include invoices that are due (not overdue) - use status_id instead of date
            status: "Due",
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } },
            ],
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                },
            },
        },
        orderBy: {
            due_date: "asc",
        },
    });

    // Group invoices by customer and calculate totals
    const customerTotals = new Map<number, { name: string; amount: number }>();

    dueInvoices.forEach((invoice) => {
        const customerId = invoice.customer_id;
        if (customerId == null) return;
        const customerName =
            invoice.Customer?.Person?.full_name ||
            invoice.Customer?.Company?.name ||
            "Unknown";

        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        const amount =
            outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt;

        if (customerTotals.has(customerId)) {
            customerTotals.get(customerId)!.amount += amount;
        } else {
            customerTotals.set(customerId, { name: customerName, amount });
        }
    });

    // Convert to array and sort by amount descending
    const customerData = Array.from(customerTotals.values())
        .map(({ name, amount }) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10); // Top 10

    // Calculate total amount for percentage calculation
    const totalAmount = customerData.reduce(
        (sum, item) => sum + item.amount,
        0
    );

    // Generate theme-based colors
    const themeColors = [
        "#6B46C1", // Primary purple
        "#9F7AEA", // Light purple
        "#4A5568", // Gray
        "#718096", // Medium gray
    ];

    // Convert to CustomerData format with percentages and colors
    const result = customerData.map((item, index) => ({
        customer: item.name,
        amount: item.amount,
        percentage:
            totalAmount > 0
                ? Math.round((item.amount / totalAmount) * 100 * 100) / 100
                : 0,
        color: themeColors[index % themeColors.length],
    }));

    return result;
};

// Function to get overdue invoices by customer data (Top 10)
export const getOverdueInvoicesByCustomerData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<CustomerData[]> => {
    const { prisma } = await import("@/lib/prisma");
    const isParentView = viewMode === "parent";

    if (isParentView) {
        // For parent view, get all parent customers without filtering by collection_status
        // Collection statistics are based on active collection periods, not collection_status
        const allParentCustomersForCollection = await prisma.customer.findMany({
            where: {
                account_id,
                parent_customer_id: null,
                ...(Object.keys(ownerFilter).length > 0 ? ownerFilter : {}),
            },
            select: {
                id: true,
                business_unit_id: true,
                type: true,
                Person: {
                    select: {
                        first_name: true,
                        last_name: true,
                        full_name: true,
                    },
                },
                Company: {
                    select: {
                        name: true,
                    },
                },
                ChildCustomers: {
                    select: {
                        id: true,
                        business_unit_id: true,
                    },
                },
            },
        });

        // Build child-to-parent map and filter by BU access
        const childToParentMapForCollection = new Map<number, number>();
        const parentIdToNameMap = new Map<number, string>();
        const accessibleChildIdsForCollection: number[] = [];
        const standaloneCustomerIdsForCollection: number[] = [];

        allParentCustomersForCollection.forEach((parent) => {
            // Store parent customer name in map
            const parentName =
                parent.type === "Person"
                    ? parent.Person?.full_name ||
                    `${parent.Person?.first_name || ""} ${parent.Person?.last_name || ""}`.trim() ||
                    "Unknown"
                    : parent.Company?.name || "Unknown";
            parentIdToNameMap.set(parent.id, parentName);

            const parentMatchesBU =
                !buFilter ||
                parent.business_unit_id === null ||
                (buFilter.OR &&
                    buFilter.OR.some(
                        (f: any) =>
                            f.business_unit_id === parent.business_unit_id ||
                            f.business_unit_id === null ||
                            (f.business_unit_id?.in &&
                                f.business_unit_id.in.includes(
                                    parent.business_unit_id
                                ))
                    ));

            const hasChildren =
                parent.ChildCustomers && parent.ChildCustomers.length > 0;

            if (hasChildren) {
                // For customers with children, collect child IDs
                const accessibleChildren = (
                    parent.ChildCustomers as any[]
                ).filter(
                    (child: any) =>
                        !buFilter ||
                        child.business_unit_id === null ||
                        (buFilter.OR &&
                            buFilter.OR.some(
                                (f: any) =>
                                    f.business_unit_id ===
                                    child.business_unit_id ||
                                    f.business_unit_id === null ||
                                    (f.business_unit_id?.in &&
                                        f.business_unit_id.in.includes(
                                            child.business_unit_id
                                        ))
                            ))
                );

                if (parentMatchesBU || accessibleChildren.length > 0) {
                    accessibleChildren.forEach((child: any) => {
                        accessibleChildIdsForCollection.push(child.id);
                        childToParentMapForCollection.set(child.id, parent.id);
                    });
                }
            } else {
                // For standalone customers (no children), include them directly if they match BU
                if (parentMatchesBU) {
                    standaloneCustomerIdsForCollection.push(parent.id);
                    childToParentMapForCollection.set(parent.id, parent.id); // Map to itself for counting
                }
            }
        });

        const allAccessibleCustomerIds = [
            ...accessibleChildIdsForCollection,
            ...standaloneCustomerIdsForCollection,
        ];

        // Build customer filter for parent view
        const customerFilter: any = {
            AND: [
                { account_id },
                {
                    CustomerCollectionPeriod: {
                        some: {
                            period_end_date: null, // Active collection period
                        },
                    },
                },
                { id: { in: allAccessibleCustomerIds } },
            ],
        };

        // Get overdue invoices grouped by customer
        const overdueInvoices = await prisma.invoice.findMany({
            where: {
                account_id,
                Customer: customerFilter,
                status: "Overdue",
                OR: [
                    { outstanding_debt: { gt: 0 } },
                    { customer_outstanding_debt: { gt: 0 } },
                ],
            },
            include: {
                Customer: {
                    include: {
                        Person: true,
                        Company: true,
                    },
                },
            },
            orderBy: {
                due_date: "asc",
            },
        });

        // Group invoices by parent customer (using childToParentMap) and calculate totals
        const customerTotals = new Map<
            number,
            { name: string; amount: number }
        >();

        overdueInvoices.forEach((invoice) => {
            const customerId = invoice.customer_id;
            if (customerId == null) return;

            // Map child customer to parent customer, or use customer itself if standalone
            const parentId =
                childToParentMapForCollection.get(customerId) || customerId;
            // Use parent customer name from map instead of child customer name
            const customerName =
                parentIdToNameMap.get(parentId) || "Unknown";

            const outstandingDebt = invoice.outstanding_debt || 0;
            const customerOutstandingDebt =
                invoice.customer_outstanding_debt || 0;
            const amount =
                outstandingDebt !== 0
                    ? outstandingDebt
                    : customerOutstandingDebt;

            if (customerTotals.has(parentId)) {
                customerTotals.get(parentId)!.amount += amount;
            } else {
                customerTotals.set(parentId, { name: customerName, amount });
            }
        });

        // Convert to array and sort by amount descending
        const customerData = Array.from(customerTotals.values())
            .map(({ name, amount }) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10); // Top 10

        // Calculate total amount for percentage calculation
        const totalAmount = customerData.reduce(
            (sum, item) => sum + item.amount,
            0
        );

        // Generate theme-based colors
        const themeColors = [
            "#6B46C1",
            "#9F7AEA",
            "#4A5568",
            "#718096",
            "#805AD5",
            "#B794F4",
            "#2D3748",
            "#A0AEC0",
            "#553C9A",
            "#D6BCFA",
        ];

        const result = customerData.map((item, index) => ({
            customer: item.name,
            amount: item.amount,
            percentage:
                totalAmount > 0
                    ? Math.round((item.amount / totalAmount) * 100 * 100) / 100
                    : 0,
            color: themeColors[index % themeColors.length],
        }));

        return result;
    }

    // Original child view logic
    // Build customer filter with owner and business unit filters using AND
    const customerFilter: any = {
        AND: [
            { collection_status: { in: ["Active", "Inactive"] } },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(buFilter && Object.keys(buFilter).length > 0 ? [buFilter] : []),
        ],
    };

    // Get overdue invoices grouped by customer
    const overdueInvoices = await prisma.invoice.findMany({
        where: {
            account_id,
            Customer: customerFilter,
            // Only include invoices that are overdue - use status_id instead of date
            status: "Overdue",
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } },
            ],
        },
        include: {
            Customer: {
                include: {
                    Person: true,
                    Company: true,
                },
            },
        },
        orderBy: {
            due_date: "asc",
        },
    });

    // Group invoices by customer and calculate totals
    const customerTotals = new Map<number, { name: string; amount: number }>();

    overdueInvoices.forEach((invoice) => {
        const customerId = invoice.customer_id;
        if (customerId == null) return;
        const customerName =
            invoice.Customer?.Person?.full_name ||
            invoice.Customer?.Company?.name ||
            "Unknown";

        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        const amount =
            outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt;

        if (customerTotals.has(customerId)) {
            customerTotals.get(customerId)!.amount += amount;
        } else {
            customerTotals.set(customerId, { name: customerName, amount });
        }
    });

    // Convert to array and sort by amount descending
    const customerData = Array.from(customerTotals.values())
        .map(({ name, amount }) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10); // Top 10

    // Calculate total amount for percentage calculation
    const totalAmount = customerData.reduce(
        (sum, item) => sum + item.amount,
        0
    );

    // Generate theme-based colors
    const themeColors = [
        "#6B46C1", // Primary purple
        "#9F7AEA", // Light purple
        "#4A5568", // Gray
        "#718096", // Medium gray
    ];

    // Convert to CustomerData format with percentages and colors
    const result = customerData.map((item, index) => ({
        customer: item.name,
        amount: item.amount,
        percentage:
            totalAmount > 0
                ? Math.round((item.amount / totalAmount) * 100 * 100) / 100
                : 0,
        color: themeColors[index % themeColors.length],
    }));

    return result;
};

// Function to get overdue invoices by business unit data (Top 10)
export const getOverdueInvoicesByBusinessUnitData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<CustomerData[]> => {
    const { prisma } = await import("@/lib/prisma");
    const isParentView = viewMode === "parent";

    // Build customer filter with owner filter (but not BU filter since we're grouping by BU)
    const customerFilter: any = {
        AND: [
            { collection_status: { in: ["Active", "Inactive"] } },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
        ],
    };

    if (isParentView) {
        // For parent view, get all parent customers without filtering by collection_status
        // Collection statistics are based on active collection periods, not collection_status
        const allParentCustomersForCollection = await prisma.customer.findMany({
            where: {
                account_id,
                parent_customer_id: null,
                ...(Object.keys(ownerFilter).length > 0 ? ownerFilter : {}),
            },
            select: {
                id: true,
                business_unit_id: true,
                ChildCustomers: {
                    select: {
                        id: true,
                        business_unit_id: true,
                    },
                },
            },
        });

        // Build child-to-parent map and filter by BU access
        const accessibleChildIdsForCollection: number[] = [];
        const standaloneCustomerIdsForCollection: number[] = [];

        allParentCustomersForCollection.forEach((parent) => {
            const parentMatchesBU =
                !buFilter ||
                parent.business_unit_id === null ||
                (buFilter.OR &&
                    buFilter.OR.some(
                        (f: any) =>
                            f.business_unit_id === parent.business_unit_id ||
                            f.business_unit_id === null ||
                            (f.business_unit_id?.in &&
                                f.business_unit_id.in.includes(
                                    parent.business_unit_id
                                ))
                    ));

            const hasChildren =
                parent.ChildCustomers && parent.ChildCustomers.length > 0;

            if (hasChildren) {
                // For customers with children, collect child IDs
                const accessibleChildren = (
                    parent.ChildCustomers as any[]
                ).filter(
                    (child: any) =>
                        !buFilter ||
                        child.business_unit_id === null ||
                        (buFilter.OR &&
                            buFilter.OR.some(
                                (f: any) =>
                                    f.business_unit_id ===
                                    child.business_unit_id ||
                                    f.business_unit_id === null ||
                                    (f.business_unit_id?.in &&
                                        f.business_unit_id.in.includes(
                                            child.business_unit_id
                                        ))
                            ))
                );

                if (parentMatchesBU || accessibleChildren.length > 0) {
                    accessibleChildren.forEach((child: any) => {
                        accessibleChildIdsForCollection.push(child.id);
                    });
                }
            } else {
                // For standalone customers (no children), include them directly if they match BU
                if (parentMatchesBU) {
                    standaloneCustomerIdsForCollection.push(parent.id);
                }
            }
        });

        const allAccessibleCustomerIds = [
            ...accessibleChildIdsForCollection,
            ...standaloneCustomerIdsForCollection,
        ];

        // Build customer filter for parent view
        const customerFilter: any = {
            AND: [
                { account_id },
                {
                    CustomerCollectionPeriod: {
                        some: {
                            period_end_date: null, // Active collection period
                        },
                    },
                },
                { id: { in: allAccessibleCustomerIds } },
            ],
        };

        // Get overdue invoices grouped by business unit
        const overdueInvoices = await prisma.invoice.findMany({
            where: {
                account_id,
                Customer: customerFilter,
                status: "Overdue",
                OR: [
                    { outstanding_debt: { gt: 0 } },
                    { customer_outstanding_debt: { gt: 0 } },
                ],
            },
            include: {
                Customer: {
                    include: {
                        BusinessUnit: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                due_date: "asc",
            },
        });

        // Group invoices by business unit and calculate totals
        const buTotals = new Map<number, { name: string; amount: number }>();

        overdueInvoices.forEach((invoice) => {
            const buId = invoice.Customer?.business_unit_id;
            if (buId == null) return;

            // Check if user has access to this BU
            const hasBUAccess =
                !buFilter ||
                buId === null ||
                (buFilter.OR &&
                    buFilter.OR.some(
                        (f: any) =>
                            f.business_unit_id === buId ||
                            f.business_unit_id === null ||
                            (f.business_unit_id?.in &&
                                f.business_unit_id.in.includes(buId))
                    ));

            if (!hasBUAccess) return;

            const buName = invoice.Customer?.BusinessUnit?.name || "Unknown";
            const outstandingDebt = invoice.outstanding_debt || 0;
            const customerOutstandingDebt =
                invoice.customer_outstanding_debt || 0;
            const amount =
                outstandingDebt !== 0
                    ? outstandingDebt
                    : customerOutstandingDebt;

            if (buTotals.has(buId)) {
                buTotals.get(buId)!.amount += amount;
            } else {
                buTotals.set(buId, { name: buName, amount });
            }
        });

        // Convert to array and sort by amount descending
        const buData = Array.from(buTotals.values())
            .filter((item) => item.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10); // Top 10

        // Calculate total amount for percentage calculation
        const totalAmount = buData.reduce((sum, item) => sum + item.amount, 0);

        // Generate theme-based colors
        const themeColors = [
            "#6B46C1",
            "#9F7AEA",
            "#4A5568",
            "#718096",
            "#805AD5",
            "#B794F4",
            "#2D3748",
            "#A0AEC0",
            "#553C9A",
            "#D6BCFA",
        ];

        return buData.map((item, index) => ({
            customer: item.name,
            amount: item.amount,
            percentage:
                totalAmount > 0
                    ? Math.round((item.amount / totalAmount) * 100 * 100) / 100
                    : 0,
            color: themeColors[index % themeColors.length],
        }));
    }

    // Child view logic - group invoices by business unit
    const overdueInvoices = await prisma.invoice.findMany({
        where: {
            account_id,
            Customer: customerFilter,
            status: "Overdue",
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } },
            ],
        },
        include: {
            Customer: {
                include: {
                    BusinessUnit: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            due_date: "asc",
        },
    });

    // Group invoices by business unit and calculate totals
    const buTotals = new Map<number, { name: string; amount: number }>();

    overdueInvoices.forEach((invoice) => {
        const buId = invoice.Customer?.business_unit_id;
        if (buId == null) return;

        // Check if user has access to this BU
        const hasBUAccess =
            !buFilter ||
            buId === null ||
            (buFilter.OR &&
                buFilter.OR.some(
                    (f: any) =>
                        f.business_unit_id === buId ||
                        f.business_unit_id === null ||
                        (f.business_unit_id?.in &&
                            f.business_unit_id.in.includes(buId))
                ));

        if (!hasBUAccess) return;

        const buName = invoice.Customer?.BusinessUnit?.name || "Unknown";
        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        const amount =
            outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt;

        if (buTotals.has(buId)) {
            buTotals.get(buId)!.amount += amount;
        } else {
            buTotals.set(buId, { name: buName, amount });
        }
    });

    // Convert to array and sort by amount descending
    const buData = Array.from(buTotals.values())
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10); // Top 10

    // Calculate total amount for percentage calculation
    const totalAmount = buData.reduce((sum, item) => sum + item.amount, 0);

    // Generate theme-based colors
    const themeColors = [
        "#6B46C1", // Primary purple
        "#9F7AEA", // Light purple
        "#4A5568", // Gray
        "#718096", // Medium gray
        "#805AD5",
        "#B794F4",
        "#2D3748",
        "#A0AEC0",
        "#553C9A",
        "#D6BCFA",
    ];

    // Convert to CustomerData format with percentages and colors
    const result = buData.map((item, index) => ({
        customer: item.name,
        amount: item.amount,
        percentage:
            totalAmount > 0
                ? Math.round((item.amount / totalAmount) * 100 * 100) / 100
                : 0,
        color: themeColors[index % themeColors.length],
    }));

    return result;
};

// Function to get due invoices by business unit data (Top 10)
export const getInvoicesByBusinessUnitData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<CustomerData[]> => {
    const { prisma } = await import("@/lib/prisma");
    const isParentView = viewMode === "parent";

    // Build customer filter with owner filter (but not BU filter since we're grouping by BU)
    const customerFilter: any = {
        AND: [
            { collection_status: { in: ["Active", "Inactive"] } },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
        ],
    };

    if (isParentView) {
        // For parent view, aggregate from child customers' invoices
        const parentWhere = {
            AND: [
                { account_id },
                ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
                { parent_customer_id: null }, // Only parent customers
            ],
        };

        const parentCustomers = await prisma.customer.findMany({
            where: parentWhere,
            include: {
                ChildCustomers: {
                    where: {
                        collection_status: { in: ["Active", "Inactive"] },
                    },
                    include: {
                        BusinessUnit: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        Invoice: {
                            where: {
                                status: "Due",
                                OR: [
                                    { outstanding_debt: { gt: 0 } },
                                    { customer_outstanding_debt: { gt: 0 } },
                                ],
                            },
                            select: {
                                outstanding_debt: true,
                                customer_outstanding_debt: true,
                            },
                        },
                    },
                },
            },
        });

        // Group by business unit and calculate totals
        const buTotals = new Map<number, { name: string; amount: number }>();

        parentCustomers.forEach((parent) => {
            parent.ChildCustomers?.forEach((child) => {
                const buId = child.business_unit_id;
                if (buId == null) return;

                // Check if user has access to this BU
                const hasBUAccess =
                    !buFilter ||
                    buId === null ||
                    (buFilter.OR &&
                        buFilter.OR.some(
                            (f: any) =>
                                f.business_unit_id === buId ||
                                f.business_unit_id === null ||
                                (f.business_unit_id?.in &&
                                    f.business_unit_id.in.includes(buId))
                        ));

                if (!hasBUAccess) return;

                const buName = child.BusinessUnit?.name || "Unknown";
                const childAmount = child.Invoice.reduce((sum, invoice) => {
                    const outstandingDebt = invoice.outstanding_debt || 0;
                    const customerOutstandingDebt =
                        invoice.customer_outstanding_debt || 0;
                    const amount =
                        outstandingDebt !== 0
                            ? outstandingDebt
                            : customerOutstandingDebt;
                    return sum + amount;
                }, 0);

                if (buTotals.has(buId)) {
                    buTotals.get(buId)!.amount += childAmount;
                } else {
                    buTotals.set(buId, { name: buName, amount: childAmount });
                }
            });
        });

        // Convert to array and sort by amount descending
        const buData = Array.from(buTotals.values())
            .filter((item) => item.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10); // Top 10

        // Calculate total amount for percentage calculation
        const totalAmount = buData.reduce((sum, item) => sum + item.amount, 0);

        // Generate theme-based colors
        const themeColors = [
            "#6B46C1",
            "#9F7AEA",
            "#4A5568",
            "#718096",
            "#805AD5",
            "#B794F4",
            "#2D3748",
            "#A0AEC0",
            "#553C9A",
            "#D6BCFA",
        ];

        return buData.map((item, index) => ({
            customer: item.name,
            amount: item.amount,
            percentage:
                totalAmount > 0
                    ? Math.round((item.amount / totalAmount) * 100 * 100) / 100
                    : 0,
            color: themeColors[index % themeColors.length],
        }));
    }

    // Child view logic - group invoices by business unit
    const dueInvoices = await prisma.invoice.findMany({
        where: {
            account_id,
            Customer: customerFilter,
            status: "Due",
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } },
            ],
        },
        include: {
            Customer: {
                include: {
                    BusinessUnit: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            due_date: "asc",
        },
    });

    // Group invoices by business unit and calculate totals
    const buTotals = new Map<number, { name: string; amount: number }>();

    dueInvoices.forEach((invoice) => {
        const buId = invoice.Customer?.business_unit_id;
        if (buId == null) return;

        // Check if user has access to this BU
        const hasBUAccess =
            !buFilter ||
            buId === null ||
            (buFilter.OR &&
                buFilter.OR.some(
                    (f: any) =>
                        f.business_unit_id === buId ||
                        f.business_unit_id === null ||
                        (f.business_unit_id?.in &&
                            f.business_unit_id.in.includes(buId))
                ));

        if (!hasBUAccess) return;

        const buName = invoice.Customer?.BusinessUnit?.name || "Unknown";
        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        const amount =
            outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt;

        if (buTotals.has(buId)) {
            buTotals.get(buId)!.amount += amount;
        } else {
            buTotals.set(buId, { name: buName, amount });
        }
    });

    // Convert to array and sort by amount descending
    const buData = Array.from(buTotals.values())
        .filter((item) => item.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10); // Top 10

    // Calculate total amount for percentage calculation
    const totalAmount = buData.reduce((sum, item) => sum + item.amount, 0);

    // Generate theme-based colors
    const themeColors = [
        "#6B46C1", // Primary purple
        "#9F7AEA", // Light purple
        "#4A5568", // Gray
        "#718096", // Medium gray
        "#805AD5",
        "#B794F4",
        "#2D3748",
        "#A0AEC0",
        "#553C9A",
        "#D6BCFA",
    ];

    // Convert to CustomerData format with percentages and colors
    const result = buData.map((item, index) => ({
        customer: item.name,
        amount: item.amount,
        percentage:
            totalAmount > 0
                ? Math.round((item.amount / totalAmount) * 100 * 100) / 100
                : 0,
        color: themeColors[index % themeColors.length],
    }));

    return result;
};

function buildMaturityScheduleCustomerFilter(
    ownerFilter: OwnerFilter,
    buFilter?: any,
    isParentView = false
): {
    AND: Array<Record<string, unknown>>;
} {
    return {
        AND: [
            { collection_status: { in: ["Active", "Inactive"] } },
            ...(Object.keys(ownerFilter).length > 0 ? [ownerFilter] : []),
            ...(!isParentView && buFilter && Object.keys(buFilter).length > 0
                ? [buFilter]
                : []),
        ],
    };
}

async function fetchDueInvoicesForMaturitySchedule(
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<{
    invoices: any[];
    childToParentMap: Map<number, number> | null;
}> {
    const { prisma } = await import("@/lib/prisma");
    const isParentView = viewMode === "parent";
    const today = new Date();
    const dueInvoiceWhere = {
        status: "Due" as const,
        due_date: {
            gte: today,
        },
        OR: [
            { outstanding_debt: { gt: 0 } },
            { customer_outstanding_debt: { gt: 0 } },
        ],
    };
    const customerInclude = {
        Customer: {
            include: {
                Person: true,
                Company: true,
            },
        },
    };

    if (isParentView) {
        const parentCustomers = await prisma.customer.findMany({
            where: {
                account_id,
                parent_customer_id: null,
                ...(Object.keys(ownerFilter).length > 0 ? ownerFilter : {}),
            },
            select: {
                id: true,
                business_unit_id: true,
                ChildCustomers: {
                    where: {
                        collection_status: { in: ["Active", "Inactive"] },
                    },
                    select: {
                        id: true,
                        business_unit_id: true,
                    },
                },
            },
        });

        const accessibleChildIds: number[] = [];
        const childToParentMap = new Map<number, number>();

        parentCustomers.forEach((parent) => {
            const parentMatchesBU =
                !buFilter ||
                parent.business_unit_id === null ||
                (buFilter.OR &&
                    buFilter.OR.some(
                        (f: any) =>
                            f.business_unit_id === parent.business_unit_id ||
                            f.business_unit_id === null ||
                            (f.business_unit_id?.in &&
                                f.business_unit_id.in.includes(
                                    parent.business_unit_id
                                ))
                    ));

            const accessibleChildren = parent.ChildCustomers.filter(
                (child) =>
                    !buFilter ||
                    child.business_unit_id === null ||
                    (buFilter.OR &&
                        buFilter.OR.some(
                            (f: any) =>
                                f.business_unit_id === child.business_unit_id ||
                                f.business_unit_id === null ||
                                (f.business_unit_id?.in &&
                                    f.business_unit_id.in.includes(
                                        child.business_unit_id
                                    ))
                        ))
            );

            if (parentMatchesBU || accessibleChildren.length > 0) {
                accessibleChildren.forEach((child) => {
                    accessibleChildIds.push(child.id);
                    childToParentMap.set(child.id, parent.id);
                });
            }
        });

        if (accessibleChildIds.length === 0) {
            return { invoices: [], childToParentMap };
        }

        const invoices = await prisma.invoice.findMany({
            where: {
                account_id,
                customer_id: {
                    in: accessibleChildIds,
                },
                ...dueInvoiceWhere,
            },
            include: customerInclude,
        });

        return { invoices, childToParentMap };
    }

    const customerFilter = buildMaturityScheduleCustomerFilter(
        ownerFilter,
        buFilter,
        false
    );
    const invoices = await prisma.invoice.findMany({
        where: {
            account_id,
            Customer: customerFilter,
            ...dueInvoiceWhere,
        },
        include: customerInclude,
    });

    return { invoices, childToParentMap: null };
}

// Function to get receivables maturity schedule data
export const getReceivablesMaturityScheduleData = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<MaturityRow[]> => {
    const isParentView = viewMode === "parent";

    const today = new Date();

    // Define maturity ranges - these represent days until due date (for future invoices)
    const maturityRanges = [
        { id: 1, min: 0, max: 7, daysRange: "0-7 days" },
        { id: 2, min: 8, max: 30, daysRange: "8-30 days" },
        { id: 3, min: 31, max: 60, daysRange: "31-60 days" },
        { id: 4, min: 61, max: 90, daysRange: "61-90 days" },
        { id: 5, min: 91, max: 180, daysRange: "91-180 days" },
        { id: 6, min: 181, max: 365, daysRange: "181-365 days" },
        { id: 7, min: 366, max: 9999, daysRange: "365 days+" },
    ];

    const maturityData: MaturityRow[] = [];

    const { invoices: allDueInvoices, childToParentMap } =
        await fetchDueInvoicesForMaturitySchedule(
            account_id,
            ownerFilter,
            buFilter,
            viewMode
        );

    // Calculate total portfolio value for percentage calculations
    const totalPortfolioValue = allDueInvoices.reduce((sum, invoice) => {
        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        // Use outstanding_debt if not 0, otherwise use customer_outstanding_debt (includes negative amounts/credits)
        const amount =
            outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt;
        return sum + amount;
    }, 0);

    // Process each maturity range
    for (const range of maturityRanges) {
        // Filter invoices by their days until due date
        const rangeInvoices = allDueInvoices.filter((invoice) => {
            if (!invoice.due_date) return false;

            // Normalize dates to compare only the date part (ignore time)
            const dueDate = new Date(invoice.due_date);
            const todayDate = new Date(today);

            // Set both dates to midnight for accurate day comparison
            dueDate.setHours(0, 0, 0, 0);
            todayDate.setHours(0, 0, 0, 0);

            const daysUntilDue = Math.floor(
                (dueDate.getTime() - todayDate.getTime()) /
                (1000 * 60 * 60 * 24)
            );

            // For due invoices (future), daysUntilDue is positive
            return daysUntilDue >= range.min && daysUntilDue <= range.max;
        });

        // Calculate outstanding amount for invoices in this range
        const totalOutstandingAmount = rangeInvoices.reduce((sum, invoice) => {
            const outstandingDebt = invoice.outstanding_debt || 0;
            const customerOutstandingDebt =
                invoice.customer_outstanding_debt || 0;
            // Use outstanding_debt if not 0, otherwise use customer_outstanding_debt (includes negative amounts/credits)
            const amount =
                outstandingDebt !== 0
                    ? outstandingDebt
                    : customerOutstandingDebt;
            return sum + amount;
        }, 0);

        // Count invoices in this range
        const invoiceCount = rangeInvoices.length;

        // Count unique customers in this range
        // In parent view, count parent customers instead of child customers
        const customerIds = new Set<number>();
        rangeInvoices.forEach((invoice) => {
            if (!invoice.customer_id) return;
            if (isParentView && childToParentMap) {
                // Map child customer ID to parent customer ID
                const parentId = childToParentMap.get(invoice.customer_id);
                if (parentId !== undefined) {
                    customerIds.add(parentId);
                }
            } else {
                customerIds.add(invoice.customer_id);
            }
        });
        const customerCount = customerIds.size;

        // Calculate percentage of total portfolio
        const amountPercentage =
            totalPortfolioValue > 0
                ? `${((totalOutstandingAmount / totalPortfolioValue) * 100).toFixed(2)}%`
                : "0.00%";

        maturityData.push({
            id: range.id,
            invoices: invoiceCount,
            accounts: customerCount,
            amount: Math.round(totalOutstandingAmount),
            daysRange: range.daysRange,
            amountPercentage,
        });
    }

    return maturityData;
};

// Function to get invoices by maturity range for chart details
export const getInvoicesByMaturityRange = async (
    account_id: number,
    ownerFilter: OwnerFilter,
    daysRange: string,
    buFilter?: any,
    viewMode: "child" | "parent" = "child"
): Promise<DueAmountData> => {
    const today = new Date();

    // Parse the days range to get min and max days
    const rangeMap: { [key: string]: { min: number; max: number } } = {
        "0-7 days": { min: 0, max: 7 },
        "8-30 days": { min: 8, max: 30 },
        "31-60 days": { min: 31, max: 60 },
        "61-90 days": { min: 61, max: 90 },
        "91-180 days": { min: 91, max: 180 },
        "181-365 days": { min: 181, max: 365 },
        "365 days+": { min: 366, max: 9999 },
    };

    const range = rangeMap[daysRange];
    if (!range) {
        return { amount: 0, details: [] };
    }

    const { invoices: allDueInvoices } =
        await fetchDueInvoicesForMaturitySchedule(
            account_id,
            ownerFilter,
            buFilter,
            viewMode
        );

    // Filter invoices by their days until due date
    const rangeInvoices = allDueInvoices.filter((invoice) => {
        if (!invoice.due_date) return false;

        // Normalize dates to compare only the date part (ignore time)
        const dueDate = new Date(invoice.due_date);
        const todayDate = new Date(today);

        // Set both dates to midnight for accurate day comparison
        dueDate.setHours(0, 0, 0, 0);
        todayDate.setHours(0, 0, 0, 0);

        const daysUntilDue = Math.floor(
            (dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // For due invoices (future), daysUntilDue is positive
        return daysUntilDue >= range.min && daysUntilDue <= range.max;
    });

    // Calculate total amount using consistent logic
    const totalAmount = rangeInvoices.reduce((sum, invoice) => {
        const outstandingDebt = invoice.outstanding_debt || 0;
        const customerOutstandingDebt = invoice.customer_outstanding_debt || 0;
        // Use outstanding_debt if not 0, otherwise use customer_outstanding_debt (includes negative amounts/credits)
        const amount =
            outstandingDebt !== 0 ? outstandingDebt : customerOutstandingDebt;
        return sum + amount;
    }, 0);

    return {
        amount: totalAmount,
        details: rangeInvoices,
    };
};
