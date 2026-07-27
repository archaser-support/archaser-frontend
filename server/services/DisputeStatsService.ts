import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { AccessControlService } from "@/server/services/AccessControlService";

// Centralized dispute statistics calculation
export interface DisputeStatistics {
    total_customers: number;
    total_invoices: number;
    total_outstanding_amount: number;
    currency: string;
    pieChartData: {
        labels: string[];
        series: number[];
    };
    disputeAssignFrequencyList: Array<{
        name: string;
        dispute_count: number;
        user_image: string | null;
    }>;
}

export const calculateDisputeStats = async (params: {
    account_id: number;
    user_id: string;
    search?: string;
    assignee?: string;
    reason?: string;
}) => {
    const {
        account_id,
        user_id,
        search = "",
        assignee = "",
        reason = "",
    } = params;

    // Get account currency
    const account = await prisma.account.findUnique({
        where: { id: account_id },
        select: { currency: true },
    });
    const currency = account?.currency || "";

    // Use AccessControlService to get proper filters (same as table query)
    const accessControl = AccessControlService.getInstance();

    // Get user info for proper access control
    const userInfo = await prisma.user.findUnique({
        where: { id: user_id },
        select: {
            id: true,
            account_id: true,
            role: true,
        },
    });

    if (!userInfo) {
        throw new Error("User not found");
    }

    if (!userInfo.account_id) {
        throw new Error("User account_id is required");
    }

    // Only check account_id 10013 - archaser_admin is handled by PermissionService
    const isAdmin = userInfo.account_id === 10013;

    // Check for broader access via use_view_as permission
    const { PermissionService } = await import("@/server/services/PermissionService");
    const permissionService = PermissionService.getInstance();
    const hasViewAsPermission = await permissionService.hasPermission(
        userInfo.account_id,
        userInfo.role as string,
        "use_view_as"
    );

    const ownerFilter = isAdmin
        ? {}
        : await accessControl.getOwnerFilter(
            user_id,
            hasViewAsPermission,
            undefined, // viewAsUserId
            undefined, // viewAsUserRole
            undefined  // viewAsUserAccountId
        );

    // Base filters for disputes - use same logic as table query
    const baseFilters: Prisma.CustomerDisputeWhereInput = {
        Customer: {
            account_id: account_id,
            ...ownerFilter,
        },
        dispute_status: { in: ["New", "Under_Review", "Awaiting_Update"] },
        ...(search
            ? {
                OR: [
                    {
                        Customer: {
                            Company: {
                                name: {
                                    contains: search,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                    {
                        Customer: {
                            Person: {
                                first_name: {
                                    contains: search,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                    {
                        Customer: {
                            Person: {
                                last_name: {
                                    contains: search,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                ],
            }
            : {}),
        AND: [
            ...(assignee === "My Dispute" ? [{ owner_id: user_id }] : []),
            ...(reason && reason !== "All"
                ? [{ dispute_reason_id: Number(reason) }]
                : []),
        ],
    };

    // Get all disputes with invoice details
    const allDisputes = await prisma.customerDispute.findMany({
        where: baseFilters,
        select: {
            owner_id: true,
            id: true,
            customer_id: true,
            dispute_reason_id: true,
            DisputeInvoice: {
                include: {
                    Invoice: {
                        select: {
                            id: true,
                            invoice_number: true,
                            amount: true,
                            outstanding_debt: true,
                        },
                    },
                },
            },
        },
    });

    // Count unique customers
    const uniqueCustomerIds = new Set(allDisputes.map((d) => d.customer_id));
    const uniqueCustomerCount = uniqueCustomerIds.size;

    // Gather all invoice IDs and amounts from DisputeInvoice
    const allDisputeInvoices = allDisputes.flatMap((d) => d.DisputeInvoice);
    const allInvoiceIds = Array.from(
        new Set(allDisputeInvoices.map((di) => di.Invoice?.id).filter(Boolean))
    );

    // Calculate total outstanding amount using outstanding_debt
    const totalOutstandingAmount = allDisputeInvoices.reduce(
        (sum, di) => sum + (di.Invoice?.outstanding_debt ?? 0),
        0
    );

    // Get dispute reasons for pie chart
    const reasonIdSet = Array.from(
        new Set(
            allDisputes
                .map((d) => d.dispute_reason_id)
                .filter((id): id is number => typeof id === "number")
        )
    );

    const disputeReasons =
        reasonIdSet.length > 0
            ? await prisma.disputeReason.findMany({
                where: { id: { in: reasonIdSet } },
                select: { id: true, name: true },
            })
            : [];

    const reasonCountMap = allDisputes.reduce(
        (acc, { dispute_reason_id }) => {
            if (!dispute_reason_id) return acc;
            acc[dispute_reason_id] = (acc[dispute_reason_id] || 0) + 1;
            return acc;
        },
        {} as Record<number, number>
    );

    const pieChartData = {
        labels: disputeReasons.map((r) => r.name),
        series: disputeReasons.map((r) => reasonCountMap[r.id] || 0),
    };

    // Calculate dispute assignment frequency
    const disputeAssignFrequencyMap: Record<string, number> = {};

    for (const dispute of allDisputes) {
        const userKey = dispute.owner_id || "unassigned";
        disputeAssignFrequencyMap[userKey] =
            (disputeAssignFrequencyMap[userKey] || 0) + 1;
    }

    const disputeAssignFrequencyList: Array<{
        name: string | null;
        dispute_count: number;
        user_image: string | null;
    }> = [];

    const userIds = Object.keys(disputeAssignFrequencyMap).filter(
        (id) => id !== "unassigned"
    );

    if (userIds.length > 0) {
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, image: true },
        });

        for (const user of users) {
            disputeAssignFrequencyList.push({
                name: user.name,
                dispute_count: disputeAssignFrequencyMap[user.id],
                user_image: user.image,
            });
        }
    }

    if (disputeAssignFrequencyMap["unassigned"]) {
        disputeAssignFrequencyList.push({
            name: "Unassigned",
            dispute_count: disputeAssignFrequencyMap["unassigned"],
            user_image: null,
        });
    }

    const stats = {
        pieChartData,
        disputeAssignFrequencyList,
        // Top-level properties for UI compatibility
        totalAmount: totalOutstandingAmount,
        totalCustomers: uniqueCustomerCount,
        openInvoices: allInvoiceIds.length,
        counts: {
            total_disputes: allDisputes.length,
            total_customers: uniqueCustomerCount,
            total_invoices: allInvoiceIds.length,
            total_outstanding_amount: totalOutstandingAmount,
            currency: currency,
        },
    };

    // Stats calculation completed

    return { stats };
};

export const calculateDisputeStatsForDashboard = async (params: {
    account_id: number;
    user_id: string;
    ownerFilter?: any;
}) => {
    const { account_id, user_id, ownerFilter } = params;

    // Get account currency
    const account = await prisma.account.findUnique({
        where: { id: account_id },
        select: { currency: true },
    });
    const currency = account?.currency || "";

    // Determine customer filter clause
    // If ownerFilter is provided (from AccessControlService), use it.
    // Otherwise fallback to basic user-owned logic.
    const customerClause = ownerFilter
        ? { account_id, ...ownerFilter }
        : {
            account_id,
            OR: [{ owner_id: user_id }, { owner_id: null }]
        };

    // Base filters for disputes - include only active dispute statuses for dashboard
    const baseFilters: Prisma.CustomerDisputeWhereInput = {
        Customer: customerClause,
        // Include only active dispute statuses for dashboard count
        dispute_status: { in: ["New", "Under_Review", "Awaiting_Update"] },
    };

    // Get all disputes with invoice details
    const allDisputes = await prisma.customerDispute.findMany({
        where: baseFilters,
        select: {
            owner_id: true,
            id: true,
            customer_id: true,
            dispute_reason_id: true,
            dispute_status: true,
            DisputeInvoice: {
                include: {
                    Invoice: {
                        select: {
                            id: true,
                            invoice_number: true,
                            amount: true,
                            outstanding_debt: true,
                        },
                    },
                },
            },
        },
    });

    // Count unique customers (only active dispute statuses)
    const uniqueCustomerIds = new Set(allDisputes.map((d) => d.customer_id));
    const uniqueCustomerCount = uniqueCustomerIds.size;

    // Gather all invoice IDs and amounts from DisputeInvoice
    const allDisputeInvoices = allDisputes.flatMap((d) => d.DisputeInvoice);
    const allInvoiceIds = Array.from(
        new Set(allDisputeInvoices.map((di) => di.Invoice?.id).filter(Boolean))
    );

    // Calculate total outstanding amount using outstanding_debt
    const totalOutstandingAmount = allDisputeInvoices.reduce(
        (sum, di) => sum + (di.Invoice?.outstanding_debt ?? 0),
        0
    );

    // Calculate pie chart data for dispute reasons
    const disputeReasonCounts = new Map<string, number>();
    allDisputes.forEach((dispute) => {
        const reason = String(dispute.dispute_reason_id || 'Unknown');
        disputeReasonCounts.set(reason, (disputeReasonCounts.get(reason) || 0) + 1);
    });

    const pieChartData = {
        labels: Array.from(disputeReasonCounts.keys()),
        series: Array.from(disputeReasonCounts.values()),
    };

    // Calculate dispute assignment frequency
    const disputeAssignFrequency = new Map<string, { count: number; user_image: string | null }>();
    allDisputes.forEach((dispute) => {
        const assignee = dispute.owner_id || 'Unassigned';
        const existing = disputeAssignFrequency.get(assignee);
        if (existing) {
            existing.count += 1;
        } else {
            disputeAssignFrequency.set(assignee, { count: 1, user_image: null });
        }
    });

    const disputeAssignFrequencyList = Array.from(disputeAssignFrequency.entries()).map(([name, data]) => ({
        name,
        dispute_count: data.count,
        user_image: data.user_image,
    }));

    // Date range for valid closed disputes (Current Month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // For closed disputes, we want to count disputes closed BY the agent (modified_by),
    // OR disputes in their portfolio if modified_by is not available/relevant.
    // Use the owner_id from ownerFilter if available, otherwise user_id (if not admin/all).

    let targetAgentId: string | null = null;
    if (ownerFilter && ownerFilter.owner_id) {
        targetAgentId = ownerFilter.owner_id;
    } else if (!ownerFilter && user_id) {
        // If no filter provided and not explicitly "all", assume "my" view
        // But we need to know if we are in "All" mode (Admin usually sends empty ownerFilter)
        // If ownerFilter is undefined, it might be an internal call. 
        // But based on previous logic: if ownerFilter is missing, we used specific user logic.
        targetAgentId = user_id;
    }

    // However, if ownerFilter is explicitly empty object {}, it means "All" (Admin).
    // The previous logic `ownerFilter ? ... : ...` handled undefined vs defined.
    // If ownerFilter is {}, targetAgentId should remain null.

    const closedDisputesWhere: Prisma.CustomerDisputeWhereInput = {
        dispute_status: { in: ["Resolved", "Cancelled"] },
        closed_at: {
            gte: startOfMonth,
            lte: endOfMonth,
        },
    };

    if (targetAgentId) {
        // Filter by modified_by to strictly reflect Agent Activity (disputes closed BY this user)
        closedDisputesWhere.modified_by = targetAgentId;
        // Ensure we still respect account boundary
        closedDisputesWhere.Customer = { account_id };
    } else {
        // No specific agent target (Admin view), use the customer clause (usually all accessible)
        closedDisputesWhere.Customer = customerClause;
    }

    // Count closed disputes
    const closedDisputesCount = await prisma.customerDispute.count({
        where: closedDisputesWhere,
    });


    return {
        stats: {
            // Top-level properties for UI compatibility
            totalAmount: totalOutstandingAmount,
            totalCustomers: uniqueCustomerCount,
            openInvoices: allInvoiceIds.length,
            counts: {
                total_customers: uniqueCustomerCount,
                total_invoices: allInvoiceIds.length,
                total_outstanding_amount: totalOutstandingAmount,
                currency: currency,
                total_closed: closedDisputesCount,
            },
            pieChartData,
            disputeAssignFrequencyList,
        }
    };
};
